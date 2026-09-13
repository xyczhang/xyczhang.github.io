// Game Configuration
const CONFIG = {
    canvas: {
        width: 800,
        height: 600
    },
    grid: {
        size: 50, // Larger for better voxel visibility
        visibleRows: 15
    },
    player: {
        size: 25,
        speed: 50,
        startX: 400
    },
    camera: {
        followSpeed: 0.1,
        autoScrollSpeed: 0.3,
        angle: Math.PI / 6 // 30 degree isometric angle
    },
    terrain: {
        types: ['grass', 'road', 'river'],
        roadProbability: 0.35,
        riverProbability: 0.25
    },
    vehicles: {
        minSpeed: 1.5,
        maxSpeed: 3,
        spawnChance: 0.008,
        minGap: 450
    },
    logs: {
        minSpeed: 1,
        maxSpeed: 2.5
    }
};

// Game State
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        this.isRunning = false;
        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('highScore')) || 0;
        this.maxRowReached = 0;
        
        this.camera = { y: 0 };
        this.player = null;
        this.terrain = [];
        this.vehicles = [];
        this.logs = [];
        this.trees = [];
        this.lastGrassOpenX = [CONFIG.player.startX];
        
        this.keys = {};
        this.lastMoveTime = 0;
        this.moveDelay = 150;
        
        this.init();
    }
    
    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight - 100;
        CONFIG.canvas.width = this.canvas.width;
        CONFIG.canvas.height = this.canvas.height;
        CONFIG.player.startX = Math.floor((this.canvas.width / 2) / CONFIG.grid.size) * CONFIG.grid.size + CONFIG.grid.size / 2;
    }
    
    init() {
        this.setupEventListeners();
        this.updateHighScoreDisplay();
        this.showStartScreen();
    }
    
    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
                e.preventDefault();
            }
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });
        
        document.getElementById('startBtn').addEventListener('click', () => this.start());
        document.getElementById('restartBtn').addEventListener('click', () => this.restart());
    }
    
    start() {
        document.getElementById('startScreen').classList.add('hidden');
        this.reset();
        this.isRunning = true;
        this.gameLoop();
    }
    
    reset() {
        this.score = 0;
        this.maxRowReached = 0;
        this.camera.y = 0;
        
        const startX = CONFIG.player.startX;
        this.player = {
            x: startX,
            y: 0,
            size: CONFIG.player.size,
            row: 0,
            isOnLog: false,
            logSpeed: 0
        };
        
        this.terrain = [];
        this.vehicles = [];
        this.logs = [];
        this.trees = [];
        this.lastGrassOpenX = [startX];
        
        for (let i = -10; i < 30; i++) {
            this.generateTerrainRow(i);
        }
        
        this.updateScore();
    }
    
    restart() {
        document.getElementById('gameOver').classList.add('hidden');
        this.start();
    }
    
    generateTerrainRow(row) {
        const exists = this.terrain.find(t => t.row === row);
        if (exists) return;
        
        let type;
        if (row >= -2 && row <= 2) {
            type = 'grass';
        } else {
            const rand = Math.random();
            if (rand < CONFIG.terrain.roadProbability) {
                type = 'road';
            } else if (rand < CONFIG.terrain.roadProbability + CONFIG.terrain.riverProbability) {
                type = 'river';
            } else {
                type = 'grass';
            }
        }
        
        const terrainData = {
            row: row,
            type: type,
            direction: Math.random() > 0.5 ? 1 : -1
        };
        
        this.terrain.push(terrainData);
        
        const step = CONFIG.grid.size;
        
        if (type === 'grass' && row > 2) {
            const possibleX = [];
            for (let x = step / 2; x < CONFIG.canvas.width; x += step) {
                possibleX.push(x);
            }
            
            const previousOpenX = this.lastGrassOpenX || [CONFIG.player.startX];
            const newOpenX = [];
            
            previousOpenX.forEach(prevX => {
                const candidates = possibleX.filter(x => Math.abs(x - prevX) <= step);
                if (candidates.length > 0) {
                    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
                    if (!newOpenX.includes(chosen)) newOpenX.push(chosen);
                }
            });
            
            if (newOpenX.length === 0) {
                newOpenX.push(possibleX[Math.floor(possibleX.length / 2)]);
            }
            this.lastGrassOpenX = newOpenX;
            
            possibleX.forEach(x => {
                if (!newOpenX.includes(x)) {
                    if (Math.random() < 0.20) {
                        this.trees.push({
                            row: row,
                            x: x,
                            isTall: Math.random() > 0.35
                        });
                    }
                }
            });
        }
        
        if (type === 'river') {
            const useLilyPads = Math.random() > 0.5;
            
            if (useLilyPads) {
                const prevRowLogs = this.logs.filter(l => l.row === row - 1 && l.isLilyPad);
                const padsToPlace = [];
                const minGap = 130;
                
                if (prevRowLogs.length > 0) {
                    const parentPad = prevRowLogs[Math.floor(Math.random() * prevRowLogs.length)];
                    const offsetOptions = [0, 0, -CONFIG.grid.size, CONFIG.grid.size];
                    let guaranteedX = parentPad.x + offsetOptions[Math.floor(Math.random() * offsetOptions.length)];
                    
                    guaranteedX = Math.max(50, Math.min(CONFIG.canvas.width - 50, guaranteedX));
                    padsToPlace.push(guaranteedX);
                }
                
                const targetPadCount = Math.max(3, Math.floor(CONFIG.canvas.width / 220));
                let attempts = 0;
                
                while (padsToPlace.length < targetPadCount && attempts < 50) {
                    attempts++;
                    const candidateX = 50 + Math.random() * (CONFIG.canvas.width - 100);
                    const tooClose = padsToPlace.some(x => Math.abs(x - candidateX) < minGap);
                    
                    if (!tooClose) {
                        padsToPlace.push(candidateX);
                    }
                }
                
                padsToPlace.forEach(x => {
                    this.logs.push({
                        row: row,
                        x: x,
                        width: 60,
                        height: CONFIG.grid.size - 10,
                        speed: 0,
                        isLilyPad: true
                    });
                });
            } else {
                const logCount = Math.max(2, Math.floor(CONFIG.canvas.width / 350));
                const logWidth = 120;
                const totalWidth = CONFIG.canvas.width;
                const spacing = totalWidth / logCount;
                
                for (let i = 0; i < logCount; i++) {
                    const startX = i * spacing + (spacing - logWidth) / 2;
                    const randomOffset = (Math.random() - 0.5) * 40;
                    
                    this.logs.push({
                        row: row,
                        x: startX + randomOffset,
                        width: logWidth,
                        height: CONFIG.grid.size - 10,
                        speed: (CONFIG.logs.minSpeed + Math.random() * (CONFIG.logs.maxSpeed - CONFIG.logs.minSpeed)) * terrainData.direction,
                        isLilyPad: false
                    });
                }
            }
        }
    }
    
    handleInput() {
        const now = Date.now();
        if (now - this.lastMoveTime < this.moveDelay) return;
        
        const gridSize = CONFIG.grid.size;
        let moved = false;
        let targetX = this.player.x;
        let targetY = this.player.y;
        
        if (this.keys['w'] || this.keys['arrowup']) {
            targetY -= gridSize;
            moved = true;
        } else if (this.keys['s'] || this.keys['arrowdown']) {
            targetY += gridSize;
            moved = true;
        } else if (this.keys['a'] || this.keys['arrowleft']) {
            targetX -= gridSize;
            moved = true;
        } else if (this.keys['d'] || this.keys['arrowright']) {
            targetX += gridSize;
            moved = true;
        }
        
        if (moved) {
            targetX = Math.max(30, Math.min(CONFIG.canvas.width - 30, targetX));
            const targetRow = Math.round(-targetY / gridSize);
            
            const treeBlocked = this.trees.some(t => t.row === targetRow && Math.abs(t.x - targetX) < 15);
            
            if (!treeBlocked) {
                this.player.x = targetX;
                this.player.y = targetY;
                this.lastMoveTime = now;
                this.player.row = targetRow;
                
                if (this.player.row > this.maxRowReached) {
                    this.maxRowReached = this.player.row;
                    this.score = this.maxRowReached;
                    this.updateScore();
                }
            } else {
                this.lastMoveTime = now;
            }
        }
    }
    
    update() {
        if (!this.isRunning) return;
        
        this.updateVehicles();
        this.updateLogs();
        this.handleInput();
        this.checkCollisions();
        
        if (!this.isRunning) return;
        
        if (this.player.isOnLog) {
            this.player.x += this.player.logSpeed;
            
            const playerSize = this.player.size;
            if (this.player.x < playerSize/2 || this.player.x > CONFIG.canvas.width - playerSize/2) {
                this.gameOver('drowned');
                return;
            }
        }
        
        this.camera.y -= CONFIG.camera.autoScrollSpeed;
        
        const targetCameraY = this.player.y - CONFIG.canvas.height * 0.5;
        if (targetCameraY < this.camera.y) {
            this.camera.y += (targetCameraY - this.camera.y) * CONFIG.camera.followSpeed;
        }
        
        const playerScreenY = this.player.y - this.camera.y;
        if (playerScreenY > CONFIG.canvas.height + 50) {
            this.gameOver('fell_behind');
            return;
        }
        
        const playerRow = this.player.row;
        const rowsAhead = 20;
        const targetRow = playerRow + rowsAhead;
        
        const existingRows = this.terrain.map(t => t.row);
        const maxRow = existingRows.length > 0 ? Math.max(...existingRows) : playerRow;
        
        if (targetRow > maxRow) {
            for (let i = maxRow + 1; i <= targetRow; i++) {
                this.generateTerrainRow(i);
            }
        }
        
        const rowsBehind = 10;
        this.terrain = this.terrain.filter(t => t.row > playerRow - rowsBehind);
        this.trees = this.trees.filter(t => t.row > playerRow - rowsBehind && t.row < playerRow + 30);
    }
    
    updateVehicles() {
        this.vehicles.forEach(vehicle => {
            vehicle.x += vehicle.speed;
        });
        
        this.vehicles.forEach((vehicle, index) => {
            const sameRowVehicles = this.vehicles.filter((v, i) => 
                v.row === vehicle.row && i !== index
            );
            
            for (let other of sameRowVehicles) {
                const distance = Math.abs(vehicle.x - other.x);
                const minDistance = vehicle.width + other.width + CONFIG.vehicles.minGap;
                
                if (distance < minDistance) {
                    if (Math.sign(vehicle.speed) === Math.sign(other.speed)) {
                        if (vehicle.speed > 0) {
                            if (vehicle.x < other.x) {
                                vehicle.x = other.x - minDistance;
                            } else {
                                other.x = vehicle.x - minDistance;
                            }
                        } else {
                            if (vehicle.x > other.x) {
                                vehicle.x = other.x + minDistance;
                            } else {
                                other.x = vehicle.x + minDistance;
                            }
                        }
                    }
                }
            }
        });
        
        const playerRow = this.player.row;
        this.vehicles = this.vehicles.filter(v => {
            const inBoundsX = v.x > -400 && v.x < CONFIG.canvas.width + 400;
            const inBoundsRow = v.row > playerRow - 15 && v.row < playerRow + 25;
            return inBoundsX && inBoundsRow;
        });
        
        this.terrain.forEach(t => {
            if (t.type === 'road' && Math.random() < CONFIG.vehicles.spawnChance) {
                const existingOnRow = this.vehicles.filter(v => v.row === t.row);
                
                if (existingOnRow.length < 1) {
                    const speed = (CONFIG.vehicles.minSpeed + Math.random() * (CONFIG.vehicles.maxSpeed - CONFIG.vehicles.minSpeed)) * t.direction;
                    const vehicleWidth = 70 + Math.random() * 25;
                    const spawnX = t.direction > 0 ? -vehicleWidth - 150 : CONFIG.canvas.width + 150;
                    
                    let canSpawn = true;
                    for (let existing of existingOnRow) {
                        const distance = Math.abs(spawnX - existing.x);
                        const minSafeDistance = vehicleWidth + existing.width + CONFIG.vehicles.minGap;
                        
                        if (distance < minSafeDistance) {
                            canSpawn = false;
                            break;
                        }
                    }
                    
                    if (canSpawn) {
                        this.vehicles.push({
                            row: t.row,
                            x: spawnX,
                            width: vehicleWidth,
                            height: CONFIG.grid.size - 14,
                            speed: speed,
                            color: this.getRandomCarColor()
                        });
                    }
                }
            }
        });
    }
    
    updateLogs() {
        this.logs.forEach(log => {
            if (!log.isLilyPad) {
                log.x += log.speed;
                
                if (log.x > CONFIG.canvas.width + 100) {
                    log.x = -log.width - 100;
                } else if (log.x < -log.width - 100) {
                    log.x = CONFIG.canvas.width + 100;
                }
            }
        });
        
        this.logs.forEach((log, index) => {
            if (log.isLilyPad) return;
            
            const sameRowLogs = this.logs.filter((l, i) => 
                l.row === log.row && i !== index && !l.isLilyPad
            );
            
            for (let other of sameRowLogs) {
                const distance = Math.abs(log.x - other.x);
                const minDistance = log.width + other.width + 80;
                
                if (distance < minDistance) {
                    if (Math.sign(log.speed) === Math.sign(other.speed)) {
                        if (log.speed > 0) {
                            if (log.x < other.x) {
                                log.x = other.x - minDistance;
                            } else {
                                other.x = log.x - minDistance;
                            }
                        } else {
                            if (log.x > other.x) {
                                log.x = other.x + minDistance;
                            } else {
                                other.x = log.x + minDistance;
                            }
                        }
                    }
                }
            }
        });
        
        const playerRow = this.player.row;
        this.logs = this.logs.filter(log => {
            return log.row > playerRow - 20 && log.row < playerRow + 30;
        });
    }
    
    checkCollisions() {
        if (!this.isRunning) return;
        
        const playerX = this.player.x;
        const playerSize = this.player.size;
        const currentRow = this.player.row;
        
        this.player.isOnLog = false;
        this.player.logSpeed = 0;
        
        const currentTerrain = this.terrain.find(t => t.row === currentRow);
        if (!currentTerrain) return;
        
        if (currentTerrain.type === 'road') {
            const playerLeft = playerX - playerSize / 2;
            const playerRight = playerX + playerSize / 2;
            
            for (let vehicle of this.vehicles) {
                if (vehicle.row === currentRow) {
                    const vehicleLeft = vehicle.x;
                    const vehicleRight = vehicle.x + vehicle.width;
                    
                    if (playerRight > vehicleLeft && playerLeft < vehicleRight) {
                        this.gameOver('hit');
                        return;
                    }
                }
            }
        }
        
        if (currentTerrain.type === 'river') {
            let onLog = false;
            const playerLeft = playerX - playerSize / 2;
            const playerRight = playerX + playerSize / 2;
            
            const logsOnThisRow = this.logs.filter(l => l.row === currentRow);
            
            for (let log of logsOnThisRow) {
                let logLeft, logRight;
                
                if (log.isLilyPad) {
                    logLeft = log.x - log.width / 2;
                    logRight = log.x + log.width / 2;
                } else {
                    logLeft = log.x;
                    logRight = log.x + log.width;
                }
                
                if (playerRight > logLeft && playerLeft < logRight) {
                    onLog = true;
                    this.player.isOnLog = true;
                    this.player.logSpeed = log.speed;
                    break;
                }
            }
            
            if (!onLog) {
                this.gameOver('drowned');
                return;
            }
        }
    }
    
    getRandomCarColor() {
        const colors = ['#E53935', '#1E88E5', '#FDD835', '#43A047', '#FB8C00', '#8E24AA', '#00ACC1'];
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    render() {
        const gradient = this.ctx.createLinearGradient(0, 0, 0, CONFIG.canvas.height);
        gradient.addColorStop(0, '#E8F5FB');
        gradient.addColorStop(0.5, '#B8E6F5');
        gradient.addColorStop(1, '#87CEEB');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
        
        this.ctx.save();
        this.ctx.translate(CONFIG.canvas.width / 2, CONFIG.canvas.height / 2);
        this.ctx.transform(1, -0.3, 0, 1, 0, 0);
        this.ctx.translate(-CONFIG.canvas.width / 2, -CONFIG.canvas.height / 2);
        
        // Sort active rows descending (background rows rendered first)
        const activeRows = [...new Set(this.terrain.map(t => t.row))].sort((a, b) => b - a);
        
        activeRows.forEach(row => {
            const t = this.terrain.find(item => item.row === row);
            if (t) {
                const y = -t.row * CONFIG.grid.size - this.camera.y;
                if (y > -CONFIG.grid.size && y < CONFIG.canvas.height) {
                    if (t.type === 'grass') {
                        this.drawIsometricBlock(0, y, CONFIG.canvas.width, CONFIG.grid.size, '#A8D88E', '#7AB863', '#8BC973');
                        
                        const grassCount = Math.floor(CONFIG.canvas.width / 60);
                        this.ctx.fillStyle = '#7AB863';
                        for (let i = 0; i < grassCount; i++) {
                            const x = (t.row * 123 + i * 67) % CONFIG.canvas.width;
                            const grassY = y + (i * 13) % CONFIG.grid.size;
                            this.ctx.fillRect(x, grassY, 2, 4);
                            this.ctx.fillRect(x + 2, grassY - 1, 2, 3);
                        }
                    } else if (t.type === 'road') {
                        this.drawIsometricBlock(0, y, CONFIG.canvas.width, CONFIG.grid.size, '#6D7278', '#555A5F', '#7D8287');
                        
                        const lineSpacing = 100;
                        this.ctx.fillStyle = '#FFD700';
                        for (let i = 0; i < CONFIG.canvas.width; i += lineSpacing) {
                            const dashY = y + CONFIG.grid.size / 2 - 1;
                            this.ctx.fillRect(i + 10, dashY, 40, 3);
                        }
                    } else if (t.type === 'river') {
                        const time = Date.now() / 1000;
                        const waveOffset = Math.sin(time + t.row) * 2;
                        
                        this.drawIsometricBlock(0, y + waveOffset, CONFIG.canvas.width, CONFIG.grid.size, '#87D8F5', '#5BC0EB', '#A0E0F8');
                        
                        const waveCount = Math.floor(CONFIG.canvas.width / 80);
                        this.ctx.fillStyle = 'rgba(155, 225, 250, 0.3)';
                        for (let i = 0; i < waveCount; i++) {
                            const x = (i * 80 + time * 30 * t.direction) % CONFIG.canvas.width;
                            const waveY = y + CONFIG.grid.size / 2 + Math.sin(time * 2 + i) * 3;
                            this.ctx.beginPath();
                            this.ctx.ellipse(x, waveY, 10, 5, 0, 0, Math.PI * 2);
                            this.ctx.fill();
                        }
                    }
                }
            }
            
            // Render logs / lily pads on this row
            this.logs.filter(log => log.row === row).forEach(log => {
                const y = -log.row * CONFIG.grid.size - this.camera.y + (CONFIG.grid.size - log.height) / 2;
                if (y > -100 && y < CONFIG.canvas.height + 100) {
                    if (log.isLilyPad) {
                        this.drawIsometricLilyPad(log.x, y, log.width, log.height);
                    } else {
                        this.drawIsometricLog(log.x, y, log.width, log.height);
                    }
                }
            });
            
            // Render trees on this row
            this.trees.filter(tree => tree.row === row).forEach(tree => {
                const y = -tree.row * CONFIG.grid.size - this.camera.y;
                if (y > -100 && y < CONFIG.canvas.height + 100) {
                    this.drawIsometricTree(tree.x, y, tree.isTall);
                }
            });
            
            // Render vehicles on this row
            this.vehicles.filter(vehicle => vehicle.row === row).forEach(vehicle => {
                const y = -vehicle.row * CONFIG.grid.size - this.camera.y + (CONFIG.grid.size - vehicle.height) / 2;
                if (y > -100 && y < CONFIG.canvas.height + 100) {
                    this.drawIsometricCar(vehicle.x, y, vehicle.width, vehicle.height, vehicle.color, vehicle.speed > 0);
                }
            });
            
            // Render player if currently on this row
            if (this.player && this.player.row === row) {
                const playerScreenY = this.player.y - this.camera.y;
                this.drawIsometricChicken(this.player.x, playerScreenY + CONFIG.grid.size / 2, this.player.size);
            }
        });
        
        this.ctx.restore();
        
        const dangerZoneHeight = 80;
        const dangerGradient = this.ctx.createLinearGradient(0, CONFIG.canvas.height - dangerZoneHeight, 0, CONFIG.canvas.height);
        dangerGradient.addColorStop(0, 'rgba(255, 0, 0, 0)');
        dangerGradient.addColorStop(0.5, 'rgba(255, 0, 0, 0.2)');
        dangerGradient.addColorStop(1, 'rgba(255, 0, 0, 0.4)');
        this.ctx.fillStyle = dangerGradient;
        this.ctx.fillRect(0, CONFIG.canvas.height - dangerZoneHeight, CONFIG.canvas.width, dangerZoneHeight);
        
        const playerScreenY = this.player ? this.player.y - this.camera.y : 0;
        if (playerScreenY > CONFIG.canvas.height - 150) {
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            this.ctx.font = 'bold 20px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('⚠️ MOVE UP! ⚠️', CONFIG.canvas.width / 2, CONFIG.canvas.height - 40);
            this.ctx.textAlign = 'left';
        }
    }
    
    toIso(x, y) {
        return {
            x: x - y,
            y: (x + y) / 2
        };
    }
    
    drawIsometricBlock(x, y, width, height, topColor, leftColor, rightColor) {
        const isoDepth = 15;
        
        this.ctx.fillStyle = topColor;
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(x + width, y);
        this.ctx.lineTo(x + width, y + height);
        this.ctx.lineTo(x, y + height);
        this.ctx.closePath();
        this.ctx.fill();
        
        this.ctx.fillStyle = leftColor;
        this.ctx.beginPath();
        this.ctx.moveTo(x, y + height);
        this.ctx.lineTo(x - isoDepth, y + height + isoDepth);
        this.ctx.lineTo(x + width - isoDepth, y + height + isoDepth);
        this.ctx.lineTo(x + width, y + height);
        this.ctx.closePath();
        this.ctx.fill();
        
        this.ctx.fillStyle = rightColor;
        this.ctx.fillRect(x, y, width, 2);
    }

    drawIsometricTree(x, y, isTall) {
        const trunkW = 12;
        const trunkH = 12;
        const leafW = 32;
        const leafH = 26;
        
        const baseY = y + (CONFIG.grid.size - trunkH) / 2;
        
        // Multi-layered realistic directional tree shadow
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
        this.ctx.beginPath();
        this.ctx.ellipse(x - 8, baseY + 16, 22, 8, -Math.PI / 8, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
        this.ctx.beginPath();
        this.ctx.ellipse(x - 3, baseY + 12, 14, 5, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Trunk voxel block
        this.drawVoxelBlock(x - trunkW / 2, baseY - 4, trunkW, trunkH, '#6D4C41', '#4E342E');
        
        // Lower Foliage Block
        const f1Y = baseY - 4 - leafH + 4;
        this.drawVoxelBlock(x - leafW / 2, f1Y, leafW, leafH, '#8BC34A', '#4CAF50');
        
        // Stacked Upper Foliage Block
        if (isTall) {
            const topW = leafW - 6;
            const topH = leafH - 4;
            const f2Y = f1Y - topH + 4;
            this.drawVoxelBlock(x - topW / 2, f2Y, topW, topH, '#9CCC65', '#388E3C');
        }
    }
    
    drawIsometricLog(x, y, width, height) {
        const isoDepth = 8;
        
        // Water contact depth shadow
        this.ctx.fillStyle = 'rgba(10, 30, 50, 0.35)';
        this.ctx.fillRect(x - isoDepth - 2, y + height + isoDepth, width + 4, 5);
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        this.ctx.fillRect(x - isoDepth - 6, y + height + isoDepth + 3, width + 10, 4);
        
        this.ctx.fillStyle = '#8D6E63';
        this.ctx.fillRect(x, y, width, height);
        
        this.ctx.fillStyle = '#5D4037';
        this.ctx.beginPath();
        this.ctx.moveTo(x, y + height);
        this.ctx.lineTo(x - isoDepth, y + height + isoDepth);
        this.ctx.lineTo(x + width - isoDepth, y + height + isoDepth);
        this.ctx.lineTo(x + width, y + height);
        this.ctx.closePath();
        this.ctx.fill();
        
        this.ctx.strokeStyle = '#6D4C41';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(x + 15, y + height / 2, 5, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.arc(x + width - 15, y + height / 2, 5, 0, Math.PI * 2);
        this.ctx.stroke();
        
        this.ctx.fillStyle = '#A1887F';
        this.ctx.fillRect(x + 2, y + 2, width - 4, 2);
    }
    
    drawIsometricLilyPad(x, y, width, height) {
        const isoDepth = 6;
        const centerX = x;
        const centerY = y + height / 2;
        const radiusX = width / 2;
        const radiusY = height / 2;
        
        // Ambient water depth shadow
        this.ctx.fillStyle = 'rgba(10, 35, 50, 0.3)';
        this.ctx.beginPath();
        this.ctx.ellipse(centerX - isoDepth - 2, centerY + isoDepth + 4, radiusX + 3, radiusY * 0.6, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.fillStyle = '#558B2F';
        this.ctx.beginPath();
        this.ctx.ellipse(centerX - isoDepth, centerY + isoDepth, radiusX, radiusY, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        const gradient = this.ctx.createRadialGradient(
            centerX - radiusX * 0.3,
            centerY - radiusY * 0.3,
            0,
            centerX,
            centerY,
            radiusX
        );
        gradient.addColorStop(0, '#9CCC65');
        gradient.addColorStop(0.5, '#7CB342');
        gradient.addColorStop(1, '#689F38');
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.fillStyle = '#87D8F5';
        this.ctx.beginPath();
        this.ctx.moveTo(centerX + radiusX * 0.8, centerY - radiusY * 0.2);
        this.ctx.lineTo(centerX + radiusX * 1.1, centerY);
        this.ctx.lineTo(centerX + radiusX * 0.8, centerY + radiusY * 0.2);
        this.ctx.fill();
        
        this.ctx.strokeStyle = '#689F38';
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.moveTo(centerX - radiusX * 0.7, centerY);
        this.ctx.lineTo(centerX + radiusX * 0.7, centerY);
        this.ctx.moveTo(centerX, centerY - radiusY * 0.6);
        this.ctx.lineTo(centerX, centerY + radiusY * 0.6);
        this.ctx.stroke();
        
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        this.ctx.beginPath();
        this.ctx.ellipse(centerX - radiusX * 0.3, centerY - radiusY * 0.3, radiusX * 0.3, radiusY * 0.25, 0, 0, Math.PI * 2);
        this.ctx.fill();
    }
    
    drawIsometricCar(x, y, width, height, color, facingRight) {
        const shadowOffset = 12;
        
        // 1. Double-layered realistic ambient drop shadow
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
        this.ctx.beginPath();
        this.ctx.ellipse(x + width / 2 - shadowOffset / 2, y + height + shadowOffset + 4, width * 0.55, height * 0.55, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        this.ctx.beginPath();
        this.ctx.ellipse(x + width / 2 - shadowOffset / 2, y + height + shadowOffset, width * 0.46, height * 0.38, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // 2. Chassis (Lower Car Body)
        const chassisH = height * 0.6;
        const chassisY = y + height - chassisH;
        this.drawVoxelBlock(x, chassisY, width, chassisH, color, this.darkenColor(color, 0.6));
        
        // 3. Cabin (Upper Roof Structure)
        const cabinW = width * 0.52;
        const cabinH = height * 0.5;
        const cabinX = facingRight ? x + width * 0.26 : x + width * 0.22;
        const cabinY = chassisY - cabinH + 3;
        const lighterColor = this.darkenColor(color, 1.1);
        this.drawVoxelBlock(cabinX, cabinY, cabinW, cabinH, lighterColor, this.darkenColor(color, 0.75));

        // 4. Windows (Front Windshield & Side Windows)
        this.ctx.fillStyle = 'rgba(180, 235, 255, 0.85)';
        const windW = 7;
        const windX = facingRight ? cabinX + cabinW - windW - 2 : cabinX + 2;
        this.ctx.fillRect(windX, cabinY + 2, windW, cabinH - 5);
        
        const sideWinX = facingRight ? cabinX + 4 : cabinX + windW + 4;
        const sideWinW = cabinW - windW - 8;
        this.ctx.fillRect(sideWinX, cabinY + 3, sideWinW, cabinH - 6);

        // Window Glossy Sheen
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        this.ctx.fillRect(sideWinX + 2, cabinY + 4, Math.max(2, sideWinW - 4), 2);

        // 5. Headlights & Taillights
        const headlightX = facingRight ? x + width - 2 : x;
        const taillightX = facingRight ? x : x + width - 2;
        
        // Glowing Headlights
        this.ctx.fillStyle = '#FFF176';
        this.ctx.fillRect(headlightX, chassisY + 4, 3, 6);
        this.ctx.fillStyle = 'rgba(255, 241, 118, 0.35)';
        this.ctx.beginPath();
        this.ctx.arc(facingRight ? headlightX + 5 : headlightX - 2, chassisY + 7, 7, 0, Math.PI * 2);
        this.ctx.fill();

        // Red Taillights
        this.ctx.fillStyle = '#E53935';
        this.ctx.fillRect(taillightX, chassisY + 4, 3, 5);

        // 6. Metallic Bumpers
        this.ctx.fillStyle = '#37474F';
        this.ctx.fillRect(x - 1, chassisY + chassisH - 4, width + 2, 4);

        // 7. 3D Wheels with Contact Shadow
        const wheelR = 5;
        const wheelY = chassisY + chassisH;
        const wheelX1 = x + width * 0.22;
        const wheelX2 = x + width * 0.78;
        
        [wheelX1, wheelX2].forEach(wx => {
            // Wheel ground shadow
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            this.ctx.beginPath();
            this.ctx.ellipse(wx - 2, wheelY + 3, wheelR + 1, wheelR * 0.5, 0, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Outer Rubber Tire
            this.ctx.fillStyle = '#212121';
            this.ctx.beginPath();
            this.ctx.arc(wx, wheelY + 1, wheelR, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Inner Metallic Rim
            this.ctx.fillStyle = '#B0BEC5';
            this.ctx.beginPath();
            this.ctx.arc(wx, wheelY + 1, wheelR * 0.45, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }
    
    drawIsometricChicken(x, y, size) {
        this.ctx.save();
        this.ctx.translate(x, y);
        
        // Multi-layer drop shadow
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
        this.ctx.beginPath();
        this.ctx.ellipse(-4, size * 0.42, size * 0.7, size * 0.3, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
        this.ctx.beginPath();
        this.ctx.ellipse(0, size * 0.36, size * 0.45, size * 0.18, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        const width = size * 1.1;
        const height = size * 1.0;
        const radius = size * 0.4;
        
        this.drawRoundedVoxel(-width / 2, -height / 2, width, height, '#FFF59D', '#FFEB3B', radius);
        
        this.ctx.fillStyle = 'rgba(255, 138, 128, 0.7)';
        this.ctx.beginPath();
        this.ctx.arc(-width * 0.3, 0, size * 0.11, 0, Math.PI * 2);
        this.ctx.arc(width * 0.3, 0, size * 0.11, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.fillStyle = '#212121';
        this.ctx.beginPath();
        this.ctx.arc(-width * 0.22, -height * 0.12, size * 0.11, 0, Math.PI * 2);
        this.ctx.arc(width * 0.22, -height * 0.12, size * 0.11, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.beginPath();
        this.ctx.arc(-width * 0.25, -height * 0.16, size * 0.045, 0, Math.PI * 2);
        this.ctx.arc(width * 0.19, -height * 0.16, size * 0.045, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.fillStyle = '#FF9800';
        this.ctx.beginPath();
        this.ctx.moveTo(0, -height * 0.05);
        this.ctx.lineTo(-size * 0.09, height * 0.1);
        this.ctx.lineTo(size * 0.09, height * 0.1);
        this.ctx.closePath();
        this.ctx.fill();
        
        this.ctx.fillStyle = '#FF5252';
        this.ctx.beginPath();
        this.ctx.arc(0, -height / 2 - size * 0.06, size * 0.12, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.fillStyle = '#FFA726';
        this.ctx.beginPath();
        this.ctx.ellipse(-width * 0.22, height / 2 + 2, size * 0.1, size * 0.05, 0, 0, Math.PI * 2);
        this.ctx.ellipse(width * 0.22, height / 2 + 2, size * 0.1, size * 0.05, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.restore();
    }
    
    drawRoundedVoxel(x, y, width, height, topColor, sideColor, radius) {
        const depth = 4;
        
        this.ctx.fillStyle = topColor;
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, width, height, radius);
        this.ctx.fill();
        
        this.ctx.fillStyle = sideColor;
        this.ctx.beginPath();
        this.ctx.moveTo(x + radius, y + height);
        this.ctx.lineTo(x + radius - depth, y + height + depth);
        this.ctx.lineTo(x + width - radius - depth, y + height + depth);
        this.ctx.lineTo(x + width - radius, y + height);
        this.ctx.closePath();
        this.ctx.fill();
        
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.beginPath();
        this.ctx.ellipse(x + width * 0.3, y + height * 0.3, width * 0.25, height * 0.2, 0, 0, Math.PI * 2);
        this.ctx.fill();
    }
    
    drawVoxelBlock(x, y, width, height, topColor, sideColor) {
        const depth = 5;
        
        // Front Face
        this.ctx.fillStyle = topColor;
        this.ctx.fillRect(x, y, width, height);
        
        // Bottom Face
        this.ctx.fillStyle = sideColor;
        this.ctx.beginPath();
        this.ctx.moveTo(x, y + height);
        this.ctx.lineTo(x - depth, y + height + depth);
        this.ctx.lineTo(x + width - depth, y + height + depth);
        this.ctx.lineTo(x + width, y + height);
        this.ctx.closePath();
        this.ctx.fill();
        
        // Right Side Face (Ambient Depth Shading)
        const darkSide = this.darkenColor(sideColor, 0.75);
        this.ctx.fillStyle = darkSide;
        this.ctx.beginPath();
        this.ctx.moveTo(x + width, y);
        this.ctx.lineTo(x + width - depth, y + depth);
        this.ctx.lineTo(x + width - depth, y + height + depth);
        this.ctx.lineTo(x + width, y + height);
        this.ctx.closePath();
        this.ctx.fill();
        
        // Top edge highlight
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.fillRect(x, y, width, 2);
        
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x, y, width, height);
    }
    
    darkenColor(color, factor) {
        let hex = color.replace('#', '');
        if (hex.length === 3) {
            hex = hex.split('').map(c => c + c).join('');
        }
        const r = Math.min(255, Math.floor(parseInt(hex.substr(0, 2), 16) * factor));
        const g = Math.min(255, Math.floor(parseInt(hex.substr(2, 2), 16) * factor));
        const b = Math.min(255, Math.floor(parseInt(hex.substr(4, 2), 16) * factor));
        return `rgb(${r}, ${g}, ${b})`;
    }
    
    updateScore() {
        document.getElementById('score').textContent = this.score;
        
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('highScore', this.highScore);
            this.updateHighScoreDisplay();
        }
    }
    
    updateHighScoreDisplay() {
        document.getElementById('highScore').textContent = this.highScore;
    }
    
    gameOver(cause) {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        this.deathCause = cause || 'unknown';
        
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('finalHighScore').textContent = this.highScore;
        
        setTimeout(() => {
            document.getElementById('gameOver').classList.remove('hidden');
        }, 100);
    }
    
    showStartScreen() {
        document.getElementById('startScreen').classList.remove('hidden');
    }
    
    gameLoop() {
        if (!this.isRunning) return;
        
        this.update();
        this.render();
        
        requestAnimationFrame(() => this.gameLoop());
    }
}

window.addEventListener('load', () => {
    new Game();
});