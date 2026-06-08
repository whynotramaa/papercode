"""
Number of Islands (LeetCode 200)
Given an m x n 2D binary grid 'grid' where '1' represents land and '0' represents water,
count the number of islands. An island is surrounded by water and formed by connecting
adjacent lands horizontally or vertically.
"""

from collections import deque
from typing import List


# ----------------------------------------------------------------------
# Solution 1: DFS (recursive)
# ----------------------------------------------------------------------
def num_islands_dfs(grid: List[List[str]]) -> int:
    if not grid or not grid[0]:
        return 0

    rows, cols = len(grid), len(grid[0])
    count = 0

    def dfs(r: int, c: int) -> None:
        # Bounds / water / already visited check
        if r < 0 or r >= rows or c < 0 or c >= cols or grid[r][c] == '0':
            return
        grid[r][c] = '0'  # mark visited (sink)
        dfs(r + 1, c)
        dfs(r - 1, c)
        dfs(r, c + 1)
        dfs(r, c - 1)

    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == '1':
                count += 1
                dfs(r, c)  # sink the whole island

    return count


# ----------------------------------------------------------------------
# Solution 2: BFS (iterative with queue)
# ----------------------------------------------------------------------
def num_islands_bfs(grid: List[List[str]]) -> int:
    if not grid or not grid[0]:
        return 0

    rows, cols = len(grid), len(grid[0])
    count = 0
    directions = [(1, 0), (-1, 0), (0, 1), (0, -1)]

    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == '1':
                count += 1
                grid[r][c] = '0'  # mark before enqueuing
                q = deque()
                q.append((r, c))

                while q:
                    cr, cc = q.popleft()
                    for dr, dc in directions:
                        nr, nc = cr + dr, cc + dc
                        if 0 <= nr < rows and 0 <= nc < cols and grid[nr][nc] == '1':
                            grid[nr][nc] = '0'
                            q.append((nr, nc))

    return count


# ----------------------------------------------------------------------
# Solution 3: Union-Find (Disjoint Set Union)
# ----------------------------------------------------------------------
class UnionFind:
    def __init__(self, n: int):
        self.parent = list(range(n))
        self.rank = [0] * n
        self.count = 0

    def find(self, x: int) -> int:
        # Path compression
        if self.parent[x] != x:
            self.parent[x] = self.find(self.parent[x])
        return self.parent[x]

    def union(self, x: int, y: int) -> None:
        rx, ry = self.find(x), self.find(y)
        if rx == ry:
            return
        # Union by rank
        if self.rank[rx] < self.rank[ry]:
            self.parent[rx] = ry
        elif self.rank[rx] > self.rank[ry]:
            self.parent[ry] = rx
        else:
            self.parent[ry] = rx
            self.rank[rx] += 1
        self.count -= 1


def num_islands_uf(grid: List[List[str]]) -> int:
    if not grid or not grid[0]:
        return 0

    rows, cols = len(grid), len(grid[0])
    # Map each cell to a unique index
    uf = UnionFind(rows * cols)

    # Initialise count – one per land cell
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == '1':
                uf.count += 1

    directions = [(1, 0), (0, 1)]  # only right and down avoids double-counting
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == '1':
                idx = r * cols + c
                for dr, dc in directions:
                    nr, nc = r + dr, c + dc
                    if nr < rows and nc < cols and grid[nr][nc] == '1':
                        uf.union(idx, nr * cols + nc)

    return uf.count


# ----------------------------------------------------------------------
# Tests
# ----------------------------------------------------------------------
if __name__ == "__main__":
    # Example 1
    grid1 = [
        ["1", "1", "1", "1", "0"],
        ["1", "1", "0", "1", "0"],
        ["1", "1", "0", "0", "0"],
        ["0", "0", "0", "0", "0"],
    ]
    # Deep copy for each method since they mutate the grid
    import copy

    print("DFS:", num_islands_dfs(copy.deepcopy(grid1)))
    print("BFS:", num_islands_bfs(copy.deepcopy(grid1)))
    print("UF :", num_islands_uf(copy.deepcopy(grid1)))

    # Example 2
    grid2 = [
        ["1", "1", "0", "0", "0"],
        ["1", "1", "0", "0", "0"],
        ["0", "0", "1", "0", "0"],
        ["0", "0", "0", "1", "1"],
    ]
    print("DFS:", num_islands_dfs(copy.deepcopy(grid2)))
    print("BFS:", num_islands_bfs(copy.deepcopy(grid2)))
    print("UF :", num_islands_uf(copy.deepcopy(grid2)))
