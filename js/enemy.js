export class Enemy {
    constructor(x, y, size, speed, color, hp) {
        this.x = x; this.y = y; this.size = size; this.speed = speed; this.color = color; this.maxHp = hp; this.hp = hp;
        this.image = new Image(); this.image.src = 'img/enemy.svg';
        this.stunTimer = 0;
        this.knockbackTimer = 0;
        this.knockbackForce = 0;
        this.knockbackDirection = { x: 0, y: 0 };
    }

    update(deltaTime, target) {
        if (this.stunTimer > 0) {
            this.stunTimer -= deltaTime;
            return; // 스턴 상태일 때는 움직이지 않음
        }

        if (this.knockbackTimer > 0) {
            const moveDistance = this.knockbackForce * deltaTime;
            this.x += this.knockbackDirection.x * moveDistance;
            this.y += this.knockbackDirection.y * moveDistance;
            this.knockbackForce *= 0.9; // 마찰력
            this.knockbackTimer -= deltaTime;
            return; // 스턴 상태일 때는 움직이지 않음
        }

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

    applyStun(duration) {
        this.stunTimer = Math.max(this.stunTimer, duration);
    }

    applyKnockback(directionX, directionY, force, duration) {
        this.knockbackDirection.x = directionX;
        this.knockbackDirection.y = directionY;
        this.knockbackForce = force;
        this.knockbackTimer = duration;
        this.stunTimer = Math.max(this.stunTimer, duration / 2); // 넉백 중 짧은 경직
    }

    isDead() {
        return this.hp <= 0;
    }

    draw(ctx) {
        if (this.image && this.image.complete) {
            ctx.drawImage(this.image, this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
        } else {
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
        }

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