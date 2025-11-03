// --- 1. Setup ---
const playerCanvas = document.getElementById('playerCanvas');
const playerCtx = playerCanvas.getContext('2d');

const aiCanvas = document.getElementById('aiCanvas');
const aiCtx = aiCanvas.getContext('2d');

const shopOverlay = document.getElementById('shop-overlay');
const shopContainer = document.getElementById('shop-container');

const openingOverlay = document.getElementById('opening-overlay');
const titleScreen = document.getElementById('title-screen');
const factionSelectScreen = document.getElementById('faction-select-screen');
const startGameButton = document.getElementById('start-game-button');
const factionButtons = document.querySelectorAll('.faction-button');

const gameState = {
    isPaused: false,
    isGameRunning: false,
};
const keys = {}; // Global state for keyboard input
const mouse = { x: 0, y: 0 }; // Global state for mouse position

// Track mouse position relative to the player's canvas
playerCanvas.addEventListener('mousemove', (e) => {
    const rect = playerCanvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
});
document.addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; });
document.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    keys[key] = false;

    // Shop and Pause logic
    if (['z', 'x', 'c'].includes(key) && !gameState.isPaused) {
        toggleShop(key);
    } else if (key === 'escape') {
        if (gameState.isPaused) {
            toggleShop(null); // Close any open shop
        }
    }
});

// Close shop if clicking outside the container
shopOverlay.addEventListener('click', (e) => {
    if (e.target === shopOverlay) {
        toggleShop(null);
    }
});

// --- Opening Screen Logic ---
startGameButton.addEventListener('click', () => {
    titleScreen.classList.add('hidden');
    factionSelectScreen.classList.remove('hidden');
});

factionButtons.forEach(button => {
    button.addEventListener('click', (e) => {
        const selectedFaction = e.target.dataset.faction;
        console.log(`Faction selected: ${selectedFaction}`);
        openingOverlay.classList.add('hidden');
        startGame();
    });
});

// --- 2. Skill System Classes ---

/**
 * The base class for all skills. Defines common properties like cooldown.
 */
class Skill {
    constructor(owner, cooldown, key, name) {
        this.owner = owner; // The entity (e.g., Player) that uses this skill
        this.cooldown = cooldown; // Cooldown duration in seconds
        this.name = name; // e.g., "Area Blast"
        this.key = key;
        this.lastUsedTimestamp = -Infinity; // Timestamp of the last use
        this.level = 1;
    }

    upgrade() {
        this.level++;
    }

    /**
     * Checks if the skill is ready to be used.
     * @returns {boolean} True if the skill is off cooldown.
     */
    canUse() {
        return (performance.now() - this.lastUsedTimestamp) / 1000 >= this.cooldown;
    }

    /**
     * Gets the remaining cooldown as a fraction (0.0 to 1.0).
     * 1.0 means the cooldown just started, 0.0 means it's ready.
     * @returns {number}
     */
    getCooldownProgress() {
        if (this.canUse()) return 0;
        const elapsed = (performance.now() - this.lastUsedTimestamp) / 1000;
        return 1 - (elapsed / this.cooldown);
    }

    /**
     * Activates the skill. This method should be overridden by subclasses.
     */
    use() {
        if (this.canUse()) {
            console.log(`Using skill on key: ${this.key}`);
            this.lastUsedTimestamp = performance.now();
            return true;
        }
        console.log(`Skill ${this.key} is on cooldown.`);
        return false;
    }
}

/**
 * A sample skill: A circular Area of Effect (AOE) attack around the player.
 */
class AoeSkill extends Skill {
    constructor(owner, cooldown, key, name, radius, damage) {
        super(owner, cooldown, key, name);
        this.baseDamage = damage;
        this.baseRadius = radius;
        this.updateStats();
    }

    updateStats() {
        this.damage = this.baseDamage + (this.level - 1) * 5; // Level up: +5 damage
        this.radius = this.baseRadius + (this.level - 1) * 10; // Level up: +10 radius
    }

    upgrade() {
        super.upgrade();
        this.updateStats();
    }

    use(world) {
        if (super.use()) {
            // Find all enemies within the radius
            world.enemies.forEach(enemy => {
                const dx = enemy.x - this.owner.x;
                const dy = enemy.y - this.owner.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance <= this.radius) {
                    enemy.takeDamage(this.damage);
                }
            });

            // 스킬 사용 시 시각 효과 생성
            const effect = new VisualEffect(this.owner.x, this.owner.y, this.radius, 'rgba(135, 206, 250, 0.7)', 0.3);
            world.effects.push(effect);
        }
    }
}

/**
 * A skill that fires a projectile towards a target point (e.g., mouse cursor).
 */
class ProjectileSkill extends Skill {
    constructor(owner, cooldown, key, name, projectileSpeed, damage) {
        super(owner, cooldown, key, name);
        this.baseDamage = damage;
        this.projectileSpeed = projectileSpeed;
        this.updateStats();
    }

    updateStats() {
        this.damage = this.baseDamage + (this.level - 1) * 3; // Level up: +3 damage
    }

    upgrade() {
        super.upgrade();
        this.updateStats();
    }

    use(world) {
        const nearestEnemy = world.findNearestEnemy(this.owner);

        if (nearestEnemy && super.use()) {
            const dx = nearestEnemy.x - this.owner.x;
            const dy = nearestEnemy.y - this.owner.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 0) {
                // Calculate velocity vector
                const vx = (dx / dist) * this.projectileSpeed;
                const vy = (dy / dist) * this.projectileSpeed;

                const projectile = new Projectile(this.owner.x, this.owner.y, vx, vy, 5, 'lightgreen', this.damage);
                world.projectiles.push(projectile);
            }
        }
    }
}

class Projectile {
    constructor(x, y, vx, vy, size, color, damage) {
        this.x = x; this.y = y;
        this.vx = vx; this.vy = vy;
        this.size = size; this.color = color;
        this.damage = damage;
        this.collided = false;
    }

    update(deltaTime) {
        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Gem {
    constructor(x, y, value) {
        this.x = x;
        this.y = y;
        this.value = value;
        this.size = 5;
        this.color = 'gold';
        this.attractionSpeed = 800; // 보석이 끌려오는 속도를 대폭 상향
    }

    update(deltaTime, target) {
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // 항상 플레이어를 향해 이동
        if (dist > 1) { // 겹쳤을 때 떨리는 현상 방지
            this.x += (dx / dist) * this.attractionSpeed * deltaTime;
            this.y += (dy / dist) * this.attractionSpeed * deltaTime;
        }
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

class AutoAttack {
    constructor(owner, name) {
        this.owner = owner;
        this.name = name;
        this.level = 0; // Starts at level 0 (not owned)
    }

    upgrade() {
        this.level++;
        this.updateStats();
    }

    updateStats() {
        // To be implemented by subclasses
    }

    update(deltaTime) {
        // To be implemented by subclasses
    }

    draw(ctx) {
        // To be implemented by subclasses
    }
}

class OrbitingSphere extends AutoAttack {
    constructor(owner) {
        super(owner, 'Orbiting Sphere');
        this.spheres = []; // Array to hold individual sphere data
        this.updateStats();
    }

    updateStats() {
        this.damage = 5 + (this.level - 1) * 2;
        this.orbitRadius = 60 + (this.level - 1) * 5;
        this.rotationSpeed = 2 + (this.level - 1) * 0.2;

        // Add a new sphere for each level
        if (this.level > 0 && this.spheres.length < this.level) {
            const angle = (this.spheres.length * 2 * Math.PI) / this.level;
            this.spheres.push({ angle: angle });
        }
    }

    update(deltaTime) {
        this.spheres.forEach(sphere => {
            sphere.angle += this.rotationSpeed * deltaTime;
            const x = this.owner.x + Math.cos(sphere.angle) * this.orbitRadius;
            const y = this.owner.y + Math.sin(sphere.angle) * this.orbitRadius;
            
            // TODO: Add collision detection with enemies here
        });
    }

    draw(ctx) {
        ctx.fillStyle = 'magenta';
        this.spheres.forEach(sphere => {
            const x = this.owner.x + Math.cos(sphere.angle) * this.orbitRadius;
            const y = this.owner.y + Math.sin(sphere.angle) * this.orbitRadius;
            ctx.beginPath();
            ctx.arc(x, y, 8, 0, Math.PI * 2);
            ctx.fill();
        });
    }
}

class VisualEffect {
    constructor(x, y, radius, color, duration) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.duration = duration; // in seconds
        this.life = duration;
    }

    update(deltaTime) {
        this.life -= deltaTime;
    }

    isDead() {
        return this.life <= 0;
    }

    draw(ctx) {
        // 시간이 지남에 따라 투명해지는 효과
        const opacity = Math.max(0, this.life / this.duration);
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}
// --- 3. World & Entity Classes ---

/**
 * 게임 월드(플레이어 또는 AI의 세계)의 모든 상태와 객체를 관리합니다.
 */
class World {
    constructor(canvas, isPlayerWorld = false) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.isPlayerWorld = isPlayerWorld;

        // The main character of this world (can be player or AI)
        this.character = new Player(
            canvas.width / 2,
            canvas.height / 2,
            isPlayerWorld ? 'skyblue' : 'orange',
            this // Pass the world instance to the player
        );

        this.enemies = [];
        this.projectiles = [];
        this.gems = [];
        this.effects = [];
        this.enemySpawnTimer = 0;
        this.enemySpawnInterval = 1.0; // 1초마다 스폰
    }

    /**
     * 이 월드의 모든 상태를 업데이트합니다.
     * @param {number} deltaTime - 프레임 간 시간 간격 (초)
     */
    update(deltaTime) {
        this.character.update(deltaTime, keys, this.isPlayerWorld);

        // 적 스폰 로직
        this.enemySpawnTimer += deltaTime;
        if (this.enemySpawnTimer > this.enemySpawnInterval) {
            this.spawnEnemy();
            this.enemySpawnTimer = 0;
        }

        // 엔티티 업데이트
        this.gems.forEach(gem => gem.update(deltaTime, this.character));
        this.enemies.forEach(enemy => enemy.update(deltaTime, this.character));
        this.projectiles.forEach(p => p.update(deltaTime));
        this.character.ownedAutoAttacks.forEach(aa => aa.update(deltaTime));
        this.effects.forEach(e => e.update(deltaTime));

        // 충돌 감지
        this.handleCollisions();

        // --- 객체 정리 ---
        // 충돌했거나 화면 밖으로 나간 투사체 제거
        this.projectiles = this.projectiles.filter(p => 
            !p.collided && p.x > 0 && p.x < this.canvas.width && p.y > 0 && p.y < this.canvas.height
        );

        // 죽은 적을 제거하고 그 자리에 보석 생성
        const newGems = [];
        this.enemies = this.enemies.filter(enemy => {
            if (enemy.isDead()) {
                newGems.push(new Gem(enemy.x, enemy.y, 10)); // 10 골드 가치의 보석 드랍
                return false;
            }
            return true;
        });
        this.gems.push(...newGems);

        // 수집된 보석 제거
        this.gems = this.gems.filter(gem => {
            const dx = this.character.x - gem.x;
            const dy = this.character.y - gem.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < this.character.size / 2 + gem.size) {
                this.character.addGold(gem.value);
                return false;
            }
            return true;
        });

        // 수명이 다한 시각 효과 제거
        this.effects = this.effects.filter(e => !e.isDead());
    }

    /**
     * 이 월드의 모든 객체를 그립니다.
     */
    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw entities
        this.enemies.forEach(enemy => enemy.draw(this.ctx));
        this.gems.forEach(gem => gem.draw(this.ctx));
        this.projectiles.forEach(p => p.draw(this.ctx));
        this.effects.forEach(e => e.draw(this.ctx));
        this.character.ownedAutoAttacks.forEach(aa => aa.draw(this.ctx));
        this.character.draw(this.ctx);

        // Draw UI on top
        this.character.drawSkillUI(this.ctx);
    }

    findNearestEnemy(position) {
        let nearestEnemy = null;
        let minDistanceSq = Infinity; // 제곱 거리를 사용하여 불필요한 제곱근 계산 방지

        for (const enemy of this.enemies) {
            const dx = enemy.x - position.x;
            const dy = enemy.y - position.y;
            const distanceSq = dx * dx + dy * dy;

            if (distanceSq < minDistanceSq) {
                minDistanceSq = distanceSq;
                nearestEnemy = enemy;
            }
        }

        return nearestEnemy;
    }

    handleCollisions() {
        // 투사체 vs 적
        for (const p of this.projectiles) {
            if (p.collided) continue;
            for (const e of this.enemies) {
                const dx = p.x - e.x;
                const dy = p.y - e.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < p.size + e.size / 2) {
                    e.takeDamage(p.damage);
                    p.collided = true;
                    break; // 투사체는 하나의 적만 관통
                }
            }
        }
    }

    /**
     * 이 월드에 적을 생성합니다.
     */
    spawnEnemy() {
        const size = 20;
        const speed = 100;
        let x, y;

        if (Math.random() < 0.5) {
            x = Math.random() < 0.5 ? 0 - size : this.canvas.width + size;
            y = Math.random() * this.canvas.height;
        } else {
            x = Math.random() * this.canvas.width;
            y = Math.random() < 0.5 ? 0 - size : this.canvas.height + size;
        }
        this.enemies.push(new Enemy(x, y, size, speed, 'crimson', 30)); // 30 HP
    }
}

class Player {
    constructor(x, y, color, world) {
        this.x = x;
        this.y = y;
        this.size = 20;
        this.speed = 200; // pixels per second
        this.color = color;
        this.world = world; // Reference to the world it belongs to

        this.gold = 0;
        this.nextSkillToUpgrade = 0; // For AI upgrade logic

        // Skill setup
        // The player character now holds the skills
        this.skills = {
            'q': new AoeSkill(this, 5, 'Q', 'Blast', 100, 10),
            'w': new ProjectileSkill(this, 0.5, 'W', 'Shot', 400, 5),
            // 'e': new DashSkill(this, 8, 'E', ...),
            // 'r': new UltimateSkill(this, 60, 'R', ...),
        };

        // Auto-Attack setup
        this.availableAutoAttacks = {
            'orbitingSphere': new OrbitingSphere(this),
        };
        this.ownedAutoAttacks = [];
    }

    update(deltaTime, keys, isPlayerControlled) {
        if (isPlayerControlled) {
            // Handle movement
            const speed = this.speed * deltaTime;
            if (keys['arrowup']) this.y -= speed;
            if (keys['arrowdown']) this.y += speed;
            if (keys['arrowleft']) this.x -= speed;
            if (keys['arrowright']) this.x += speed;

            // Handle skill usage
            if (keys['q']) this.skills['q']?.use(this.world);
            if (keys['w']) this.skills['w']?.use(this.world);
            // if (keys['e']) this.skills['e']?.use(this.world);
            // if (keys['r']) this.skills['r']?.use(this.world);

        } else {
            // --- AI Logic ---
            const speed = this.speed * deltaTime;

            // 1. AI Skill Usage
            Object.values(this.skills).forEach(skill => {
                if (skill.canUse()) {
                    skill.use(this.world);
                }
            });

            // 1.5 AI Upgrade Logic
            const skillKeys = Object.keys(this.skills);
            if (skillKeys.length > 0) {
                const keyToUpgrade = skillKeys[this.nextSkillToUpgrade % skillKeys.length];
                const skillToUpgrade = this.skills[keyToUpgrade];
                const cost = 10 + (skillToUpgrade.level - 1) * 15;

                if (this.gold >= cost) {
                    if (this.spendGold(cost)) {
                        skillToUpgrade.upgrade();
                        console.log(`AI Upgraded ${skillToUpgrade.name} to level ${skillToUpgrade.level}`);
                        this.nextSkillToUpgrade++;
                    }
                }
            }

            // 2. AI Movement (Avoidance & Patrolling)
            const panicDistance = 100;
            const nearestEnemy = this.world.findNearestEnemy(this);
            let moveX = 0; // 매 프레임 이동 방향을 초기화합니다.
            let moveY = 0;

            // 최우선 순위: 회피
            if (nearestEnemy) { 
                const dx = this.x - nearestEnemy.x;
                const dy = this.y - nearestEnemy.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < panicDistance) { // If enemy is too close, run away
                    moveX = dx / dist;
                    moveY = dy / dist;
                }
            }
            
            // 차선책: 순찰 (회피 중이 아닐 때만)
            if (moveX === 0 && moveY === 0) { // If not running away, patrol
                // 순찰 경로의 목표 지점을 계산합니다.
                const time = performance.now() / 1000;
                const targetX = this.world.canvas.width / 2 + Math.cos(time) * 80;
                const targetY = this.world.canvas.height / 2 + Math.sin(time) * 80;
                const dx = targetX - this.x;
                const dy = targetY - this.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 1) { // 목표 지점으로 이동할 방향 벡터 계산
                    moveX = dx / dist;
                    moveY = dy / dist;
                }
            }

            // 계산된 방향 벡터로 AI를 이동시킵니다.
            this.x += moveX * speed;
            this.y += moveY * speed;
        }

        // Boundary check
        this.x = Math.max(this.size / 2, Math.min(this.world.canvas.width - this.size / 2, this.x));
        this.y = Math.max(this.size / 2, Math.min(this.world.canvas.height - this.size / 2, this.y));
    }

    addGold(amount) {
        this.gold += amount;
        console.log(`Gained ${amount} gold. Total: ${this.gold}`);
    }

    spendGold(amount) {
        if (this.gold >= amount) {
            this.gold -= amount;
            return true;
        }
        return false;
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2);
        ctx.fill();
    }

    drawSkillUI(ctx) {
        const iconSize = 50;
        const padding = 10;
        const startX = (ctx.canvas.width - (Object.keys(this.skills).length * (iconSize + padding) - padding)) / 2;
        const startY = ctx.canvas.height - iconSize - 20;

        Object.entries(this.skills).forEach(([key, skill], index) => {
            const x = startX + index * (iconSize + padding);
            const y = startY;

            // Draw Icon Background
            ctx.fillStyle = '#333';
            ctx.strokeStyle = skill.canUse() ? '#aaa' : '#888';
            ctx.lineWidth = 2;
            ctx.fillRect(x, y, iconSize, iconSize);
            ctx.strokeRect(x, y, iconSize, iconSize);

            // Draw Skill Key
            ctx.fillStyle = 'white';
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(key.toUpperCase(), x + iconSize - 5, y + iconSize - 5);

            // Draw Skill Level
            ctx.fillStyle = 'gold';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(`Lv.${skill.level}`, x + 4, y + 14);

            // Draw Cooldown Overlay
            const cooldownProgress = skill.getCooldownProgress();
            if (cooldownProgress > 0) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.fillRect(x, y, iconSize, iconSize * cooldownProgress);

                // Draw Cooldown Text
                const remainingTime = (skill.cooldown * cooldownProgress).toFixed(1);
                ctx.fillStyle = 'white';
                ctx.font = 'bold 20px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(remainingTime, x + iconSize / 2, y + iconSize / 2 + 8);
            }
        });

        // Draw Gold UI
        ctx.fillStyle = 'gold';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = this.world.isPlayerWorld ? 'left' : 'right';
        const goldX = this.world.isPlayerWorld ? 10 : ctx.canvas.width - 10;
        ctx.fillText(`Gold: ${this.gold}`, goldX, 30);

        // For AI, we don't need to draw the shop-related UI
        if (!this.world.isPlayerWorld) return;
    }
}

class Enemy {
    constructor(x, y, size, speed, color, hp) {
        this.x = x; this.y = y; this.size = size; this.speed = speed; this.color = color; this.maxHp = hp; this.hp = hp;
    }

    update(deltaTime, target) {
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
            this.x += (dx / dist) * this.speed * deltaTime;
            this.y += (dy / dist) * this.speed * deltaTime;
        }
    }

    takeDamage(damage) {
        this.hp -= damage;
    }

    isDead() {
        return this.hp <= 0;
    }

    draw(ctx) {
        // Draw enemy body
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);

        // Draw health bar if damaged
        if (this.hp < this.maxHp) {
            const barWidth = this.size;
            const barHeight = 5;
            const barX = this.x - barWidth / 2;
            const barY = this.y - this.size / 2 - barHeight - 2;
            const hpPercent = this.hp / this.maxHp;

            ctx.fillStyle = '#333';
            ctx.fillRect(barX, barY, barWidth, barHeight);
            ctx.fillStyle = 'green';
            ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);
        }
    }
}

// --- 4. UI and Game State Functions ---

function toggleShop(shopType) {
    const wasPaused = gameState.isPaused;
    // If we are opening the same shop that is already open, close it.
    // Or if we are closing with Esc (shopType is null).
    if ((wasPaused && shopContainer.dataset.shopType === shopType) || !shopType) {
        gameState.isPaused = false;
        shopOverlay.classList.add('hidden');
        shopContainer.innerHTML = '';
        shopContainer.dataset.shopType = '';
    } else {
        // Open a new shop
        gameState.isPaused = true;
        shopOverlay.classList.remove('hidden');
        shopContainer.dataset.shopType = shopType;
        renderShopContent(shopType);
    }
}

function renderShopContent(shopType) {
    let title = '';
    let content = '';

    switch (shopType) {
        case 'z':
            title = '무기 상점';
            content = getWeaponShopHTML();
            break;
        case 'x':
            title = '스킬 업그레이드';
            content = getSkillShopHTML();
            break;
        case 'c':
            title = '무기/스킬 조합';
            content = '<p>조합 기능은 여기에 구현됩니다.</p>';
            break;
        default:
            return;
    }

    shopContainer.innerHTML = `
        <h2>${title}</h2>
        <div>${content}</div>
        <p style="text-align: center; margin-top: 40px; color: #888;">(ESC 키나 바깥 영역을 클릭하여 닫기)</p>
    `;

    // Add event listeners for weapon shop
    document.querySelectorAll('.upgrade-weapon-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const weaponKey = e.target.dataset.weaponKey;
            const player = playerWorld.character;
            const weapon = player.availableAutoAttacks[weaponKey];
            const cost = 25 + weapon.level * 25; // Example cost

            if (player.spendGold(cost)) {
                weapon.upgrade();
                // 첫 구매 시, 소유 목록에 추가
                if (weapon.level === 1) {
                    player.ownedAutoAttacks.push(weapon);
                }
                console.log(`Upgraded ${weapon.name} to level ${weapon.level}`);
                renderShopContent('z'); // Re-render weapon shop
                playerWorld.draw(); // Update gold UI
            } else {
                console.log('Not enough gold!');
            }
        });
    });


    // Add event listeners to the new buttons
    document.querySelectorAll('.upgrade-skill-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const skillKey = e.target.dataset.skillKey;
            const player = playerWorld.character;
            const skill = player.skills[skillKey];
            const cost = 10 + (skill.level - 1) * 15; // Example cost formula

            if (player.spendGold(cost)) {
                skill.upgrade();
                console.log(`Upgraded ${skill.name} to level ${skill.level}`);
                // Re-render the shop to show updated values
                renderShopContent('x');
                // Also update the main gold UI
                playerWorld.draw();
            } else {
                console.log('Not enough gold!');
                // Optionally, show a "Not enough gold" message to the player
            }
        });
    });
}

function getWeaponShopHTML() {
    const player = playerWorld.character;
    let html = '<div style="display: flex; flex-direction: column; gap: 15px;">';

    for (const [key, weapon] of Object.entries(player.availableAutoAttacks)) {
        const cost = 25 + weapon.level * 25; // Example cost
        const buttonText = weapon.level === 0 ? `Buy (${cost} G)` : `Upgrade (${cost} G)`;
        html += `
            <div style="background: #2a2a2a; padding: 10px; border-radius: 5px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h4 style="margin: 0 0 5px 0;">${weapon.name} (Lv. ${weapon.level})</h4>
                    <p style="margin: 0; font-size: 14px; color: #aaa;">
                        ${weapon.level > 0 ? `Spheres: ${weapon.level} / Damage: ${weapon.damage}` : 'Not owned'}
                    </p>
                </div>
                <button class="upgrade-weapon-btn" data-weapon-key="${key}" style="padding: 10px 15px; cursor: pointer;">
                    ${buttonText}
                </button>
            </div>
        `;
    }

    html += '</div>';
    return html;
}

function getSkillShopHTML() {
    const player = playerWorld.character;
    let html = '<div style="display: flex; flex-direction: column; gap: 15px;">';

    for (const [key, skill] of Object.entries(player.skills)) {
        const cost = 10 + (skill.level - 1) * 15; // Example cost formula
        html += `
            <div style="background: #2a2a2a; padding: 10px; border-radius: 5px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h4 style="margin: 0 0 5px 0;">${skill.name} (Lv. ${skill.level})</h4>
                    <p style="margin: 0; font-size: 14px; color: #aaa;">
                        Damage: ${skill.damage || 'N/A'}
                        ${skill.radius ? ` / Radius: ${skill.radius}` : ''}
                    </p>
                </div>
                <button class="upgrade-skill-btn" data-skill-key="${key}" style="padding: 10px 15px; cursor: pointer;">
                    Upgrade (${cost} G)
                </button>
            </div>
        `;
    }

    html += '</div>';
    return html;
}

// --- 4. Game Initialization & Loop ---
let playerWorld;
let aiWorld;

let lastTime = 0;
function gameLoop(timestamp) {
    // requestAnimationFrame은 항상 다음 프레임을 예약합니다.
    requestAnimationFrame(gameLoop);

    if (!gameState.isGameRunning) return;

    if (!gameState.isPaused) {
        const deltaTime = (timestamp - lastTime) / 1000;
        lastTime = timestamp;

        // 각 월드의 상태를 독립적으로 업데이트
        if (playerWorld) playerWorld.update(deltaTime);
        if (aiWorld) aiWorld.update(deltaTime);
    } else {
        // 일시정지 상태일 때도 lastTime을 현재 시간으로 갱신하여,
        // 정지 풀렸을 때 캐릭터가 순간이동하는 현상을 방지합니다.
        lastTime = timestamp;
    }

    // 각 월드를 해당 캔버스에 렌더링
    if (playerWorld) playerWorld.draw(); // draw() now handles all UI drawing
    if (aiWorld) aiWorld.draw();
}

function startGame() {
    gameState.isGameRunning = true;
    playerWorld = new World(playerCanvas, true);
    aiWorld = new World(aiCanvas, false);
    lastTime = performance.now();
}
// 게임 시작
requestAnimationFrame(gameLoop);
