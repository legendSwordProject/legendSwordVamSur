import { VisualEffect, Projectile } from './entities.js';

class Skill {
    constructor(owner, cooldown, key, name) {
        this.owner = owner;
        this.cooldown = cooldown;
        this.name = name;
        this.key = key;
        this.level = 1;
        this.currentCooldown = 0;
    }

    upgrade() {
        this.level++;
    }

    canUse() {
        return this.currentCooldown <= 0;
    }

    update(deltaTime) {
        if (this.currentCooldown > 0) {
            this.currentCooldown -= deltaTime;
        }
    }

    getCooldownProgress() {
        if (this.canUse()) return 0;
        return this.currentCooldown / this.cooldown;
    }

    use() {
        if (this.canUse()) {
            console.log(`Using skill on key: ${this.key}`);
            this.currentCooldown = this.cooldown;
            return true;
        }
        console.log(`Skill ${this.key} is on cooldown.`);
        return false;
    }
}

export class AoeSkill extends Skill {
    constructor(owner, cooldown, key, name, radius, damage) {
        super(owner, cooldown, key, name);
        this.baseDamage = damage;
        this.baseRadius = radius;
        this.color = owner.isPlayerControlled ? 'rgba(135, 206, 250, 0.7)' : 'rgba(255, 99, 71, 0.7)'; // Player: skyblue, AI: tomato
        this.updateStats();
    }

    updateStats() {
        this.damage = this.baseDamage + (this.level - 1) * 5;
        this.radius = this.baseRadius + (this.level - 1) * 2;
    }

    upgrade() {
        super.upgrade();
        this.updateStats();
    }

    use(world, opponent = null) {
        if (super.use()) {
            const targets = world.isDuel ? (opponent ? [opponent] : []) : world.enemies;
            targets.forEach(target => {
                if (!target) return;
                if (target === this.owner) return; // 자기 자신은 피해를 입지 않음
                const dx = target.x - this.owner.x;
                const dy = target.y - this.owner.y;
                const distance = Math.hypot(dx, dy);

                if (distance <= this.radius) {
                    target.takeDamage(this.damage);
                }
            });

            const effect = new VisualEffect(this.owner.x, this.owner.y, this.radius, this.color, 0.3);
            world.effects.push(effect);
        }
    }
}

export class ProjectileSkill extends Skill {
    constructor(owner, cooldown, key, name, projectileSpeed, damage) {
        super(owner, cooldown, key, name);
        this.baseDamage = damage;
        this.projectileSpeed = projectileSpeed;
        this.stunDuration = 0.2; // 0.2초 스턴
        this.color = owner.isPlayerControlled ? 'lightgreen' : 'lightcoral'; // Player: lightgreen, AI: lightcoral
        this.updateStats();
    }

    updateStats() {
        this.damage = this.baseDamage + (this.level - 1) * 3;
    }

    upgrade() {
        super.upgrade();
        this.updateStats();
    }

    use(world, opponent = null, deltaTime = 0) {
        const target = world.isDuel ? opponent : world.findNearestEnemy(this.owner);

        if (target && super.use()) {
            let targetX = target.x;
            let targetY = target.y;

            // AI가 조준할 때만 오차를 추가합니다.
            if (!this.owner.isPlayerControlled) {
                // 오차 범위 (px). 값이 클수록 조준이 더 많이 빗나갑니다.
                const inaccuracy = 90; // 값을 60에서 90으로 늘려 오차 범위를 확대
                targetX += (Math.random() - 0.5) * inaccuracy;
                targetY += (Math.random() - 0.5) * inaccuracy;
            }

            const dx = targetX - this.owner.x;
            const dy = targetY - this.owner.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 0) {
                const vx = (dx / dist) * this.projectileSpeed;
                const vy = (dy / dist) * this.projectileSpeed;

                const projectile = new Projectile(this.owner.x, this.owner.y, vx, vy, 5, this.color, this.damage, this.owner, 3, this.stunDuration);
                world.projectiles.push(projectile);
            }
        }
    }
}

export class DashSkill extends Skill {
    constructor(owner, cooldown, key, name, dashSpeed, dashDuration) {
        super(owner, cooldown, key, name);
        this.dashSpeed = dashSpeed;
        this.dashDuration = dashDuration;
        this.damage = 0; // 대쉬 스킬은 데미지가 없습니다.
        this.baseCooldown = cooldown;
    }

    updateStats() {
        // 레벨당 쿨타임 0.5초 감소 (최소 3초)
        const cooldownReduction = (this.level - 1) * 0.5;
        this.cooldown = Math.max(3, this.baseCooldown - cooldownReduction);
    }

    upgrade() {
        super.upgrade();
        this.updateStats();
    }

    use(world, opponent = null, deltaTime = 0) {
        if (super.use()) {
            // 스킬은 캐릭터의 대쉬 상태를 활성화시키는 역할만 합니다.
            // 실제 대쉬 로직은 Player 클래스에서 처리합니다.
            this.owner.startDash(this.dashSpeed, this.dashDuration, deltaTime, opponent);
            return true;
        }
        return false;
    }
}