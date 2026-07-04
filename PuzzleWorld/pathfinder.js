class PathFinder{
    constructor(game){
        this.game = game;
        this.enabled = false; // Set to false to disable pathfinding feature
    }

    getPlayerPosition(){
        return{
            row: this.game.player.y,
            col: this.game.player.x
        };
    }

    getTappedPosition(event) {
        const rect = this.game.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        const col = Math.floor(x / TILE_SIZE);
        const row = Math.floor(y / TILE_SIZE);
        
        return { row, col };
    }

    findPath(start, end){
        const rows = this.game.mapHeight;
        const cols = this.game.mapWidth;

        if(this.game.map[end.row][end.col] === '1'){
            return null;
        }

        const distances = Array(rows).fill().map(() => Array(cols).fill(Infinity));
        distances[start.row][start.col] = 0;

        const parent = {};

        const pq = [[0, start.row, start.col]];
        const visited = new Set();

        while(pq.length > 0){
            pq.sort((a, b) => a[0] - b[0]);
            const [dist, row, col] = pq.shift();

            const key = `${row},${col}`;

            if(visited.has(key)) continue;
            visited.add(key);

            if(row === end.row && col === end.col){
                return this.reconstructPath(parent, start, end);
            }

            const directions = [
                [0, 1],  //right
                [1, 0],  //down
                [0, -1], //left
                [-1, 0]  //up
            ];

            for(const [dr, dc] of directions){
                const newRow = row + dr;
                const newCol = col + dc;

                if(newRow < 0 || newRow >= rows || newCol < 0 || newCol >= cols) continue;
                if(this.game.map[newRow][newCol] === '1') continue;

                const newKey = `${newRow},${newCol}`;
                if(visited.has(newKey)) continue;

                const newDist = dist + 1;

                if (newDist < distances[newRow][newCol]) {
                    distances[newRow][newCol] = newDist;
                    parent[newKey] = key;
                    pq.push([newDist, newRow, newCol]);
                }
            }
        }

        return null;
    }

    reconstructPath(parent, start, end){
        const path = [];
        let current = `${end.row},${end.col}`;
        const startKey = `${start.row},${start.col}`;

        while(current !== startKey){
            const [row, col] = current.split(',').map(Number);
            path.unshift({row, col});
            current = parent[current];
            if (!current) return null;
        }
        path.unshift(start);
        return path;
    }

    drawPath(path){
        const ctx = this.game.ctx;

        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round'; 

        ctx.beginPath();

        path.forEach((pos, index) => {
            const x = pos.col * TILE_SIZE + TILE_SIZE / 2;
            const y = pos.row * TILE_SIZE + TILE_SIZE / 2;
            
            if(index === 0){
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }   
        });
        ctx.stroke();
    }

    movePlayerAlongPath(path) {
        let step = 1; // Start from 1 to skip current position
        
        const animate = () => {
            if (step >= path.length || this.game.gameWon) {
                return;
            }
            
            const pos = path[step];
            
            // Calculate direction to move
            const dx = pos.col - this.game.player.x;
            const dy = pos.row - this.game.player.y;
            
            // Use the game's movePlayer method to handle all logic
            this.game.movePlayer(dx, dy);
            
            step++;
            
            if (step < path.length && !this.game.gameWon) {
                setTimeout(animate, 200);
            }
        };
        
        animate();
    }
    handleClick(event) {
        if (!this.enabled) return; // Feature disabled
        if (this.game.gameWon) return;
        
        const start = this.getPlayerPosition();
        const end = this.getTappedPosition(event);
        
        const path = this.findPath(start, end);
        
        if (path && path.length > 1) {
            this.drawPath(path);
            
            setTimeout(() => {
                this.game.render();
                this.movePlayerAlongPath(path);
            }, 500);
        } else {
            console.log('No valid path found!');
        }
    }
    
    // Dev method to enable/disable pathfinding
    setEnabled(enabled) {
        this.enabled = enabled;
        console.log(`Pathfinding ${enabled ? 'enabled' : 'disabled'}`);
    }
}
