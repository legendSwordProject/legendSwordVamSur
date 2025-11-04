export class Projectile {
    constructor(x, y, vx, vy, size, color, damage, owner = null, life = 3, stunDuration = 0, knockback = null) {
        this.x = x; this.y = y;
        this.vx = vx; this.vy = vy;
        this.size = size; this.color = color;
        this.damage = damage;
        this.collided = false;
        this.owner = owner;
        this.image = new Image(); this.image.src = 'img/eight_way_shot.svg';
        this.life = life; // in seconds
        this.stunDuration = stunDuration;
        this.knockback = knockback; // { force, duration }
    }

    update(deltaTime) {
        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;
        this.life -= deltaTime;
    }

    isDead() {
        return this.life <= 0;
    }

    draw(ctx) {
        if (this.image && this.image.complete) {
            ctx.drawImage(this.image, this.x - this.size, this.y - this.size, this.size * 2, this.size * 2);
        } else {
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
        }
    }
}

export class Gem {
    constructor(x, y, value) {
        this.x = x;
        this.y = y;
        this.value = value;
        this.size = 5;
        this.color = 'gold';
        this.attractionSpeed = 800;
    }

    update(deltaTime, target) {
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 1) {
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

export class VisualEffect {
    constructor(x, y, radius, color, duration) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.duration = duration;
        this.life = duration;
    }

    update(deltaTime) {
        this.life -= deltaTime;
    }

    isDead() {
        return this.life <= 0;
    }

    draw(ctx) {
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

export class Obstacle {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = '#555'; // Dark grey
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}