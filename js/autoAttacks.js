import { Projectile } from './entities.js';

class AutoAttack {
    constructor(owner, name) {
        this.owner = owner;
        this.name = name;
        this.level = 0;
    }

    getDescription() {
        return `Damage: ${this.damage}`;
    }

    upgrade() {
        this.level++;
        this.updateStats();
    }

    updateStats() { }
    update(deltaTime) { }
    draw(ctx) { }
}

export class OrbitingSphere extends AutoAttack {
    constructor(owner) {
        super(owner, 'Orbiting Sphere');
        this.spheres = [];
        this.damageCooldown = 0.5; // Can only deal damage once every 0.5 seconds
        this.lastDamageTimestamp = 0;
        this.updateStats();
    }

    getDescription() {
        return `Spheres: ${this.spheres.length} / Damage: ${this.damage} / Rotation: ${this.rotationSpeed.toFixed(1)}`;
    }

    getNextLevelDescription() {
        const nextDamage = 5 + this.level * 2;
        const nextRadius = 60 + this.level * 5;
        const nextSpheres = Math.min(this.level + 1, 6);
        const nextRotationSpeed = 2 + this.level * 0.2;
        return `Spheres: ${nextSpheres} / Dmg: ${nextDamage} / Radius: ${nextRadius.toFixed(0)} / Rotation: ${nextRotationSpeed.toFixed(1)}`;
    }

    updateStats() {
        // 레벨에 따라 데미지는 항상 증가합니다.
        this.damage = 5 + (this.level - 1) * 2;
        this.orbitRadius = 60 + (this.level - 1) * 5;
        this.rotationSpeed = 2 + (this.level - 1) * 0.2;

        const maxSpheres = 6;
        const newSphereCount = Math.min(this.level, maxSpheres);

        // 구체의 개수가 변경될 때만 위치를 재계산합니다.
        if (this.level > 0 && this.spheres.length !== newSphereCount) {
            this.spheres = []; // 기존 구체 배열을 비웁니다.
            for (let i = 0; i < newSphereCount; i++) {
                const angle = (i * 2 * Math.PI) / newSphereCount; // 균등한 각도를 계산합니다.
                this.spheres.push({ angle: angle });
            }
        }
    }

    update(deltaTime) {
        this.spheres.forEach(sphere => {
            sphere.angle += this.rotationSpeed * deltaTime;
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

export class EightWayShot extends AutoAttack {
    constructor(owner) {
        super(owner, 'Eight-Way Shot');
        this.fireCooldown = 2.0; // 2초마다 발사
        this.fireTimer = this.fireCooldown; // 구매 후 쿨타임이 지나야 첫 발사되도록 수정
        this.projectileSpeed = 250;
        this.updateStats();
    }

    getDescription() {
        return `Damage: ${this.damage} / Range: ${this.range.toFixed(1)}s`;
    }

    getNextLevelDescription() {
        const nextDamage = 8 + this.level * 4;
        const nextCalculatedLife = 1.0 + this.level * 0.05;
        const maxDistance = this.owner.world.canvas.width / 4;
        const maxLife = maxDistance / this.projectileSpeed;
        const nextRange = Math.min(nextCalculatedLife, maxLife);
        return `Damage: ${nextDamage} / Range: ${nextRange.toFixed(1)}s`;
    }

    updateStats() {
        this.damage = 8 + (this.level - 1) * 4;

        // 레벨당 비행시간(range)은 0.05초씩 늘어납니다.
        const baseLife = 1.0;
        const lifePerLevel = 0.05;
        const calculatedLife = baseLife + (this.level - 1) * lifePerLevel;

        // 최대 사거리는 맵 너비의 1/4로 제한됩니다.
        const maxDistance = this.owner.world.canvas.width / 4;
        const maxLife = maxDistance / this.projectileSpeed;

        this.range = Math.min(calculatedLife, maxLife);
    }

    update(deltaTime) {
        if (this.level === 0) return;

        this.fireTimer -= deltaTime;
        if (this.fireTimer <= 0) {
            this.fireTimer = this.fireCooldown;
            this.fire();
        }
    }

    fire() {
        const directions = 8;
        for (let i = 0; i < directions; i++) {
            const angle = (i * 2 * Math.PI) / directions;
            const vx = Math.cos(angle) * this.projectileSpeed;
            const vy = Math.sin(angle) * this.projectileSpeed;
            const color = this.owner.isPlayerControlled ? 'cyan' : 'pink';
            const knockbackInfo = {
                force: 300,
                duration: 0.2
            };

            const projectile = new Projectile(
                this.owner.x, this.owner.y, vx, vy, 6, color, this.damage, this.owner, this.range, 0, knockbackInfo
            );
            this.owner.world.projectiles.push(projectile);
        }
    }

    draw(ctx) {
        if (this.level === 0) return;

        // 무기 장착 시 시각적 표시 (발사 방향을 나타내는 점)
        const directions = 8;
        const indicatorRadius = this.owner.size / 2 + 10; // 캐릭터 바로 바깥쪽
        const pointSize = 2;

        ctx.fillStyle = this.owner.isPlayerControlled ? 'cyan' : 'pink';

        for (let i = 0; i < directions; i++) {
            const angle = (i * 2 * Math.PI) / directions;
            const x = this.owner.x + Math.cos(angle) * indicatorRadius;
            const y = this.owner.y + Math.sin(angle) * indicatorRadius;
            ctx.fillRect(x - pointSize / 2, y - pointSize / 2, pointSize, pointSize);
        }
    }
}