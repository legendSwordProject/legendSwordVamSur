import { VisualEffect, Projectile } from './entities.js';

class Skill {
    constructor(owner, cooldown, key, name) {
        this.owner = owner;
        this.cooldown = cooldown;
        this.name = name;
        this.key = key;
        this.level = 1;
        this.icon = null; // 아이콘 이미지 경로
        this.isPassive = false;
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
            // console.log(`Using skill on key: ${this.key}`);
            this.currentCooldown = this.cooldown;
            return true;
        }
        // console.log(`Skill ${this.key} is on cooldown.`);
        return false;
    }
}

export class AoeSkill extends Skill {
    constructor(owner, cooldown, key, name, radius, damage) {
        super(owner, cooldown, key, name);
        this.baseDamage = damage;
        this.baseRadius = radius;
        this.color = owner.isPlayerControlled ? 'rgba(135, 206, 250, 0.7)' : 'rgba(255, 99, 71, 0.7)'; // Player: skyblue, AI: tomato
        this.icon = 'img/blast.svg';
        this.updateStats();
    }

    updateStats() {
        this.damage = this.baseDamage + (this.level - 1) * 3;
        this.radius = this.baseRadius + (this.level - 1) * 1.5;
    }

    upgrade() {
        super.upgrade();
        this.updateStats();
    }

    getNextLevelDescription() {
        const nextDamage = this.baseDamage + this.level * 3;
        const nextRadius = this.baseRadius + this.level * 1.5;
        return `Damage: ${nextDamage} / Radius: ${nextRadius}`;
    }

    getDescription() {
        return `Damage: ${this.damage} / Radius: ${this.radius}`;
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
        this.baseProjectileSpeed = projectileSpeed; // 기본 속도 저장
        this.projectileSpeed = this.baseProjectileSpeed;
        this.stunDuration = 0.2; // 0.2초 스턴
        this.color = owner.isPlayerControlled ? 'lightgreen' : 'lightcoral'; // Player: lightgreen, AI: lightcoral
        this.icon = 'img/shot.svg';
        this.updateStats();
    }

    updateStats() {
        this.damage = this.baseDamage + (this.level - 1) * 5;
        this.projectileSpeed = this.baseProjectileSpeed + (this.level - 1) * 30; // 레벨당 속도 20 증가
    }

    upgrade() {
        super.upgrade();
        this.updateStats();
    }

    getDescription() {
        return `Damage: ${this.damage} / Speed: ${this.projectileSpeed}`;
    }

    getNextLevelDescription() {
        const nextDamage = this.baseDamage + this.level * 5;
        const nextSpeed = this.baseProjectileSpeed + this.level * 30;
        return `Damage: ${nextDamage} / Speed: ${nextSpeed}`;
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
        this.icon = 'img/dash.svg';
        this.baseCooldown = cooldown;
        this.speedPerLevel = 20; // 레벨당 기본 이동속도 10 증가
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

    getDescription() {
        const speedBonus = (this.level - 1) * this.speedPerLevel;
        return `Cooldown: ${this.cooldown.toFixed(1)}s / Move Speed: +${speedBonus}`;
    }

    getNextLevelDescription() {
        const nextCooldownReduction = this.level * 0.5;
        const nextCooldown = Math.max(3, this.baseCooldown - nextCooldownReduction);
        return `Cooldown: ${nextCooldown.toFixed(1)}s / Move Speed: +${this.level * this.speedPerLevel}`;
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

export class PassiveHpSkill extends Skill {
    constructor(owner, key, name, hpPerLevel) {
        super(owner, 0, key, name); // 패시브 스킬은 쿨타임이 없습니다.
        this.hpPerLevel = hpPerLevel;
        this.damage = 0;
        this.icon = 'img/toughness.svg';
        this.isPassive = true;
    }

    updateStats() {
        // 스탯 변경 시, 소유자(Player)가 자신의 스탯을 다시 계산하도록 요청합니다.
    }

    upgrade() {
        super.upgrade();
        this.updateStats();
    }

    getDescription() {
        const hpBonus = (this.level - 1) * this.hpPerLevel;
        return `HP Bonus: +${hpBonus}`;
    }

    getNextLevelDescription() {
        const nextHpBonus = this.level * this.hpPerLevel;
        return `HP Bonus: +${nextHpBonus}`;
    }

    // 패시브 스킬은 사용 불가
    use() {
        // console.log("This is a passive skill and cannot be used.");
        return false;
    }

    // 패시브 스킬은 쿨타임이 없음
    getCooldownProgress() {
        return 0;
    }
}