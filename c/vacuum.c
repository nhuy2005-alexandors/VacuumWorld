/*
 * Vacuum World — phan tich khong gian trang thai + 4 giai thuat tim kiem.
 *
 * Luoi W x H. Trang thai = (vi tri robot, tap o con ban).
 *   - Vi tri robot: 0..W*H-1 (o = row*W + col).
 *   - Tap o ban: mang dirt[NDIRTY]. dirt[i] = vi tri o ban thu i, hoac -1
 *     neu o do da hut sach. Moi slot GAN CO DINH voi 1 o ban ban dau,
 *     khong bao gio doi vi tri slot (de state_key nhat quan).
 * Hanh dong: UP DOWN LEFT RIGHT SUCK, moi buoc cost = 1.
 * Goal: het slot dirt[i] != -1 (sach het).
 *
 * Giai thuat mu: BFS, DFS, IDS.  Co thong tin: A* (2 heuristic).
 * Bien dich: gcc -O2 -o vacuum vacuum.c   (xem c/README.md)
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <limits.h>
#include <time.h>

/* ---------- Cau hinh bai toan (5x5) ---------- */
#define W 5
#define H 5
#define NCELL (W * H)
#define START_CELL 0                 /* robot xuat phat o (0,0) */
static const int DIRTY_CELLS[] = {4, 12, 20, 24};  /* 4 o ban ban dau */
#define NDIRTY ((int)(sizeof(DIRTY_CELLS) / sizeof(DIRTY_CELLS[0])))

/* ---------- Hanh dong ---------- */
enum { UP, DOWN, LEFT, RIGHT, SUCK, NACTION };
static const char *ACTION_NAME[] = {"Up", "Down", "Left", "Right", "Suck"};

/* ---------- Trang thai ---------- */
typedef struct { int robot; int dirt[NDIRTY]; } State;   /* dirt[i]=-1 <=> o thu i da hut sach */

/* Pack robot(8bit) + tung slot dirt(8bit, -1 -> 0xFF) thanh 1 key 64-bit.
 * Slot dirt CO DINH (khong doi vi tri) nen 2 trang thai giong nhau logic
 * luon ra cung key. Gia dinh NDIRTY <= 7 de vua trong 64 bit. */
static inline uint64_t state_key(State s) {
    uint64_t k = (uint64_t)(uint8_t)s.robot;
    for (int i = 0; i < NDIRTY; i++) {
        uint8_t v = (s.dirt[i] == -1) ? 0xFFu : (uint8_t)s.dirt[i];
        k = (k << 8) | v;
    }
    return k;
}
static inline int is_goal(State s) {
    for (int i = 0; i < NDIRTY; i++) if (s.dirt[i] != -1) return 0;
    return 1;
}

/* Sinh trang thai ke tiep. Tra 0 neu hanh dong khong hop le / khong doi trang thai.
 * *out = s copy CA mang dirt (struct assignment trong C la deep-copy cho mang
 * co kich thuoc co dinh) -> khong co rui ro alias nhu con tro/heap. */
static int apply_action(State s, int a, State *out) {
    *out = s;
    if (a == SUCK) {
        for (int i = 0; i < NDIRTY; i++) {
            if (s.dirt[i] == s.robot) { out->dirt[i] = -1; return 1; }
        }
        return 0;                            /* o dang sach -> khong hut */
    }
    int r = s.robot / W, c = s.robot % W;
    if (a == UP) r--; else if (a == DOWN) r++;
    else if (a == LEFT) c--; else c++;      /* RIGHT */
    if (r < 0 || r >= H || c < 0 || c >= W) return 0;  /* dung tuong */
    out->robot = r * W + c;
    return 1;
}

/* ---------- Heuristic ---------- */
/* h1 = so o con ban (moi o can >=1 Suck). Admissible. */
static int h_dirty_count(State s) {
    int c = 0;
    for (int i = 0; i < NDIRTY; i++) if (s.dirt[i] != -1) c++;
    return c;
}

/* h2 = so o ban + Manhattan toi o ban gan nhat. Admissible (can it nhat
 * so-o-ban lan Suck VA it nhat md buoc di toi o ban dau tien). */
static int h_dirty_plus_nearest(State s) {
    int cnt = 0, best = INT_MAX;
    int r = s.robot / W, c = s.robot % W;
    for (int i = 0; i < NDIRTY; i++) {
        if (s.dirt[i] == -1) continue;
        cnt++;
        int d = abs(r - s.dirt[i] / W) + abs(c - s.dirt[i] % W);
        if (d < best) best = d;
    }
    if (cnt == 0) return 0;
    return cnt + best;
}

/* ---------- Node pool (dung lai duong di qua cha) ---------- */
typedef struct { State s; int parent; int action; int g; } Node;
#define POOL_CAP 3000000
static Node pool[POOL_CAP];
static int pool_n;

static int pool_add(State s, int parent, int action, int g) {
    if (pool_n >= POOL_CAP) { fprintf(stderr, "pool tran\n"); exit(1); }
    pool[pool_n] = (Node){s, parent, action, g};
    return pool_n++;
}

/* ---------- Hash map: uint64 key -> int value (open addressing) ---------- */
#define HASH_SIZE (1 << 20)          /* 1,048,576 slot */
#define HASH_MASK (HASH_SIZE - 1)
typedef struct { uint64_t *key; int *val; uint8_t *used; int count; } HMap;

static void hm_reset(HMap *m) { memset(m->used, 0, HASH_SIZE); m->count = 0; }
static void hm_init(HMap *m) {
    m->key = malloc(sizeof(uint64_t) * HASH_SIZE);
    m->val = malloc(sizeof(int) * HASH_SIZE);
    m->used = malloc(HASH_SIZE);
    hm_reset(m);
}

static inline int hm_slot(uint64_t k) {
    return (int)((k * 0x9E3779B97F4A7C15ULL) >> 44) & HASH_MASK;
}
/* Tra 1 neu tim thay, gan *out = value. */
static int hm_get(HMap *m, uint64_t k, int *out) {
    int i = hm_slot(k);
    while (m->used[i]) {
        if (m->key[i] == k) { if (out) *out = m->val[i]; return 1; }
        i = (i + 1) & HASH_MASK;
    }
    return 0;
}
static void hm_put(HMap *m, uint64_t k, int v) {
    int i = hm_slot(k);
    while (m->used[i]) {
        if (m->key[i] == k) { m->val[i] = v; return; }
        i = (i + 1) & HASH_MASK;
    }
    m->used[i] = 1; m->key[i] = k; m->val[i] = v; m->count++;
}

/* ---------- Chi so so sanh ---------- */
typedef struct {
    long expanded;       /* so node lay ra de mo rong */
    long generated;      /* so node ke tiep sinh ra */
    int  sol_len;        /* do dai loi giai (-1 neu khong tim thay) */
    long peak_frontier;  /* kich thuoc frontier lon nhat */
    double ms;
} Metrics;

/* Dung lai chuoi hanh dong tu node dich, in ra. Tra do dai. */
static int reconstruct(int goal_idx, int *sol) {
    int len = 0;
    for (int i = goal_idx; pool[i].parent != -1; i = pool[i].parent)
        sol[len++] = pool[i].action;
    for (int i = 0; i < len / 2; i++) {         /* dao nguoc */
        int t = sol[i]; sol[i] = sol[len - 1 - i]; sol[len - 1 - i] = t;
    }
    return len;
}

/* ---------- Bien dung chung ---------- */
static HMap g_closed, g_bestg;       /* dung lai giua cac lan tim */
static int frontier[POOL_CAP];       /* queue / stack index node */

/* ======================= BFS (mu, toi uu voi cost deu) ======================= */
static Metrics bfs(State start, int *sol) {
    Metrics m = {0, 0, -1, 0, 0};
    clock_t t0 = clock();
    pool_n = 0; hm_reset(&g_closed);
    int head = 0, tail = 0;
    int root = pool_add(start, -1, -1, 0);
    frontier[tail++] = root; hm_put(&g_closed, state_key(start), 1);

    while (head < tail) {
        if (tail - head > m.peak_frontier) m.peak_frontier = tail - head;
        int cur = frontier[head++];
        State s = pool[cur].s;
        if (is_goal(s)) { m.sol_len = reconstruct(cur, sol); break; }
        m.expanded++;
        for (int a = 0; a < NACTION; a++) {
            State ns;
            if (!apply_action(s, a, &ns)) continue;
            m.generated++;
            uint64_t k = state_key(ns);
            if (hm_get(&g_closed, k, NULL)) continue;   /* da tham */
            hm_put(&g_closed, k, 1);
            frontier[tail++] = pool_add(ns, cur, a, pool[cur].g + 1);
        }
    }
    m.ms = (double)(clock() - t0) / CLOCKS_PER_SEC * 1000.0;
    return m;
}

/* ======================= DFS (mu, KHONG toi uu) ======================= */
static Metrics dfs(State start, int *sol) {
    Metrics m = {0, 0, -1, 0, 0};
    clock_t t0 = clock();
    pool_n = 0; hm_reset(&g_closed);
    int top = 0;
    int root = pool_add(start, -1, -1, 0);
    frontier[top++] = root; hm_put(&g_closed, state_key(start), 1);

    while (top > 0) {
        if (top > m.peak_frontier) m.peak_frontier = top;
        int cur = frontier[--top];
        State s = pool[cur].s;
        if (is_goal(s)) { m.sol_len = reconstruct(cur, sol); break; }
        m.expanded++;
        for (int a = 0; a < NACTION; a++) {
            State ns;
            if (!apply_action(s, a, &ns)) continue;
            m.generated++;
            uint64_t k = state_key(ns);
            if (hm_get(&g_closed, k, NULL)) continue;
            hm_put(&g_closed, k, 1);
            frontier[top++] = pool_add(ns, cur, a, pool[cur].g + 1);
        }
    }
    m.ms = (double)(clock() - t0) / CLOCKS_PER_SEC * 1000.0;
    return m;
}

/* ======================= IDS (mu, toi uu) ======================= */
/* DLS dung cycle-check tren duong di hien tai (khong dung closed toan cuc,
 * de giu tinh toi uu cua IDS). */
#define MAX_DEPTH 80
static State path_states[MAX_DEPTH + 1];
static int  path_actions[MAX_DEPTH];

static int dls(State s, int limit, int depth, Metrics *m, int *sol) {
    if (is_goal(s)) {
        for (int i = 0; i < depth; i++) sol[i] = path_actions[i];
        m->sol_len = depth;
        return 1;
    }
    if (depth == limit) return 0;
    m->expanded++;
    if (depth > m->peak_frontier) m->peak_frontier = depth;
    path_states[depth] = s;
    for (int a = 0; a < NACTION; a++) {
        State ns;
        if (!apply_action(s, a, &ns)) continue;
        int on_path = 0;                         /* bo trang thai da co tren duong di */
        for (int i = 0; i <= depth; i++)
            if (state_key(path_states[i]) == state_key(ns)) { on_path = 1; break; }
        if (on_path) continue;
        m->generated++;
        path_actions[depth] = a;
        if (dls(ns, limit, depth + 1, m, sol)) return 1;
    }
    return 0;
}

static Metrics ids(State start, int *sol) {
    Metrics m = {0, 0, -1, 0, 0};
    clock_t t0 = clock();
    for (int limit = 0; limit <= MAX_DEPTH; limit++)
        if (dls(start, limit, 0, &m, sol)) break;
    m.ms = (double)(clock() - t0) / CLOCKS_PER_SEC * 1000.0;
    return m;
}

/* ======================= A* (co thong tin) ======================= */
/* Min-heap theo f = g + h. Lazy deletion: bo qua node da nam trong closed. */
typedef struct { int f, node; } HeapItem;
static HeapItem heap[POOL_CAP];
static int heap_n;

static void heap_push(int f, int node) {
    int i = heap_n++;
    heap[i] = (HeapItem){f, node};
    while (i > 0) {                              /* sift-up */
        int p = (i - 1) / 2;
        if (heap[p].f <= heap[i].f) break;
        HeapItem t = heap[p]; heap[p] = heap[i]; heap[i] = t; i = p;
    }
}
static HeapItem heap_pop(void) {
    HeapItem top = heap[0];
    heap[0] = heap[--heap_n];
    int i = 0;
    for (;;) {                                   /* sift-down */
        int l = 2 * i + 1, r = 2 * i + 2, s = i;
        if (l < heap_n && heap[l].f < heap[s].f) s = l;
        if (r < heap_n && heap[r].f < heap[s].f) s = r;
        if (s == i) break;
        HeapItem t = heap[s]; heap[s] = heap[i]; heap[i] = t; i = s;
    }
    return top;
}

static Metrics astar(State start, int (*h)(State), int *sol) {
    Metrics m = {0, 0, -1, 0, 0};
    clock_t t0 = clock();
    pool_n = 0; heap_n = 0; hm_reset(&g_closed); hm_reset(&g_bestg);
    int root = pool_add(start, -1, -1, 0);
    hm_put(&g_bestg, state_key(start), 0);
    heap_push(0 + h(start), root);

    while (heap_n > 0) {
        if (heap_n > m.peak_frontier) m.peak_frontier = heap_n;
        HeapItem it = heap_pop();
        int cur = it.node;
        State s = pool[cur].s;
        uint64_t k = state_key(s);
        if (hm_get(&g_closed, k, NULL)) continue;    /* node cu (lazy delete) */
        hm_put(&g_closed, k, 1);
        if (is_goal(s)) { m.sol_len = reconstruct(cur, sol); break; }
        m.expanded++;
        for (int a = 0; a < NACTION; a++) {
            State ns;
            if (!apply_action(s, a, &ns)) continue;
            m.generated++;
            int ng = pool[cur].g + 1, old;
            uint64_t nk = state_key(ns);
            if (hm_get(&g_bestg, nk, &old) && ng >= old) continue;  /* co duong tot hon */
            hm_put(&g_bestg, nk, ng);
            heap_push(ng + h(ns), pool_add(ns, cur, a, ng));
        }
    }
    m.ms = (double)(clock() - t0) / CLOCKS_PER_SEC * 1000.0;
    return m;
}

/* ---------- In ket qua ---------- */
static State initial_state(void) {
    State s; s.robot = START_CELL;
    for (int i = 0; i < NDIRTY; i++) s.dirt[i] = DIRTY_CELLS[i];
    return s;
}

static int cell_is_dirty(State s, int cell) {
    for (int i = 0; i < NDIRTY; i++) if (s.dirt[i] == cell) return 1;
    return 0;
}

static void print_grid(State s) {
    printf("Luoi %dx%d (R=robot, *=ban, .=sach):\n", W, H);
    for (int r = 0; r < H; r++) {
        printf("  ");
        for (int c = 0; c < W; c++) {
            int cell = r * W + c;
            char ch = (cell == s.robot) ? 'R' : cell_is_dirty(s, cell) ? '*' : '.';
            printf("%c ", ch);
        }
        printf("\n");
    }
}

static void print_solution(State start, int *sol, int len) {
    printf("\nLoi giai A* (h2), %d buoc:\n  ", len);
    State s = start;
    for (int i = 0; i < len; i++) {
        printf("%s", ACTION_NAME[sol[i]]);
        State ns; apply_action(s, sol[i], &ns); s = ns;
        printf("%s", i + 1 < len ? " -> " : "\n");
    }
}

static void row(const char *name, Metrics m) {
    printf("  %-10s | %8d | %10ld | %10ld | %10ld | %8.2f\n",
           name, m.sol_len, m.expanded, m.generated, m.peak_frontier, m.ms);
}

int main(void) {
    hm_init(&g_closed); hm_init(&g_bestg);
    State start = initial_state();

    printf("=== VACUUM WORLD ===\n");
    print_grid(start);
    long long space = (long long)NCELL << NDIRTY;
    printf("\nKhong gian trang thai dat toi: %d o x 2^%d = %lld trang thai\n",
           NCELL, NDIRTY, space);
    printf("Branching factor toi da: %d hanh dong/node\n\n", NACTION);

    int sol[POOL_CAP > 100000 ? 100000 : POOL_CAP];
    int a2[100000];
    Metrics mbfs = bfs(start, sol);
    Metrics mdfs = dfs(start, sol);
    Metrics mids = ids(start, sol);
    Metrics ma1  = astar(start, h_dirty_count, sol);
    Metrics ma2  = astar(start, h_dirty_plus_nearest, a2);

    printf("So sanh giai thuat:\n");
    printf("  %-10s | %8s | %10s | %10s | %10s | %8s\n",
           "Algo", "SolLen", "Expanded", "Generated", "PeakFront", "Time(ms)");
    printf("  -----------+----------+------------+------------+------------+---------\n");
    row("BFS",       mbfs);
    row("DFS",       mdfs);
    row("IDS",       mids);
    row("A* (h1)",   ma1);
    row("A* (h2)",   ma2);

    printf("\n  Y nghia cac cot:\n");
    printf("    SolLen    : so buoc cua loi giai tim duoc (nho hon = tot; toi uu = ngan nhat)\n");
    printf("    Expanded  : so node LAY RA khoi frontier de mo rong (cong sinh ra con)\n");
    printf("    Generated : tong so node SINH RA (con cua cac node da mo)\n");
    printf("    PeakFront : so node ton nhieu nhat trong frontier cung luc (~ dinh bo nho)\n");
    printf("    Time(ms)  : thoi gian chay giai thuat (mili-giay)\n");

    print_solution(start, a2, ma2.sol_len);

    /* Self-check: cac giai thuat toi uu phai ra cung do dai loi giai. */
    if (!(mbfs.sol_len == mids.sol_len &&
          mbfs.sol_len == ma1.sol_len &&
          mbfs.sol_len == ma2.sol_len)) {
        fprintf(stderr, "\n[LOI] BFS/IDS/A* khong cung do dai toi uu!\n");
        return 1;
    }
    printf("\n[OK] BFS = IDS = A*(h1) = A*(h2) = %d buoc (deu toi uu). "
           "DFS = %d buoc (co the dai hon).\n", mbfs.sol_len, mdfs.sol_len);
           
    printf("\n(Nhan Enter de thoat...)");
    getchar();
    return 0;
}
