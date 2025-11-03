import { Player } from './player.js';
import { Enemy } from './enemy.js';
import { Gem, Obstacle } from './entities.js';

/**
 * The game world, managing all entities and game logic for one screen.
 */
export class World {
    constructor(canvas, isPlayerWorld = false, characterName) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.isPlayerWorld = isPlayerWorld;

        if (!isPlayerWorld && characterName === 'Duel Field') {
            this.characters = [];
        } else {
            this.character = new Player(
                canvas.width / 2,
                canvas.height / 2,
                isPlayerWorld ? 'skyblue' : 'orange',
                this,
                characterName
            );
        }

        this.obstacles = [];
        this.enemies = [];
        this.projectiles = [];
        this.gems = [];
        this.effects = [];
        this.enemySpawnTimer = 0;
        this.enemySpawnInterval = 1.0;
    }

    update(deltaTime) {
        if (this.isDuel) {
            // 결투장에서는 상대방 정보를 넘겨주며 업데이트
            this.characters[0].update(deltaTime, this.characters[1]); // Player
            this.characters[1].update(deltaTime, this.characters[0]); // AI
        } else {
            this.character.update(deltaTime);
            
            // 캐릭터가 부활 중일 때는 몬스터 스폰 및 업데이트를 중지합니다.
            if (this.character.respawnTimer <= 0) {
                this.enemySpawnTimer += deltaTime;
                if (this.enemySpawnTimer > this.enemySpawnInterval) {
                    this.spawnEnemy();
                    this.enemySpawnTimer = 0;
                }
    
                this.gems.forEach(gem => gem.update(deltaTime, this.character));
                this.enemies.forEach(enemy => enemy.update(deltaTime, this.character));
            }
        }

        this.projectiles.forEach(p => p.update(deltaTime));
        if (this.isDuel) {
            this.characters.forEach(char => char.ownedAutoAttacks.forEach(aa => aa.update(deltaTime)));
        } else {
            this.character.ownedAutoAttacks.forEach(aa => aa.update(deltaTime));
        }
        this.effects.forEach(e => e.update(deltaTime));

        this.handleCollisions();
        if (this.isDuel) {
            // 결투장에서는 투사체만 제거합니다.
            this.projectiles = this.projectiles.filter(p =>
                !p.collided && !p.isDead() && p.x > 0 && p.x < this.canvas.width && p.y > 0 && p.y < this.canvas.height
            );
        } else {
            this.cleanupEntities();
        }
    }

    cleanupEntities() {
        this.projectiles = this.projectiles.filter(p => !p.collided && !p.isDead() && p.x > 0 && p.x < this.canvas.width && p.y > 0 && p.y < this.canvas.height);

        const newGems = [];
        this.enemies = this.enemies.filter(enemy => {
            if (enemy.isDead()) {
                newGems.push(new Gem(enemy.x, enemy.y, 10));
                return false;
            }
            return true;
        });
        this.gems.push(...newGems);

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

        this.effects = this.effects.filter(e => !e.isDead());
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.obstacles.forEach(o => o.draw(this.ctx));
        this.projectiles.forEach(p => p.draw(this.ctx));
        this.effects.forEach(e => e.draw(this.ctx));

        if (this.isDuel) {
            this.characters.forEach(char => {
                char.ownedAutoAttacks.forEach(aa => aa.draw(this.ctx));
                char.draw(this.ctx);
                char.drawSkillUI(this.ctx);
            });
        } else {
            this.enemies.forEach(enemy => enemy.draw(this.ctx));
            this.gems.forEach(gem => gem.draw(this.ctx));
            this.character.ownedAutoAttacks.forEach(aa => aa.draw(this.ctx));
            this.character.draw(this.ctx);
            this.character.drawSkillUI(this.ctx);
        }
    }

    findNearestEnemy(position) {
        let nearestEnemy = null;
        let minDistanceSq = Infinity;

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
        const targets = this.isDuel ? this.characters : this.enemies;
        const owners = this.isDuel ? this.characters : [this.character];

        // 투사체 vs 타겟
        for (const projectile of this.projectiles) {
            if (projectile.collided) continue;
            for (const target of targets) {
                if (projectile.owner === target) continue; // 자기 자신은 맞지 않음

                const dx = projectile.x - target.x;
                const dy = projectile.y - target.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < projectile.size + target.size / 2) {
                    target.takeDamage(projectile.damage);
                    if (projectile.stunDuration > 0) {
                        target.applyStun(projectile.stunDuration);
                    }

                    // 넉백 효과 적용
                    if (projectile.knockback) {
                        const dirX = (target.x - projectile.owner.x);
                        const dirY = (target.y - projectile.owner.y);
                        const dist = Math.hypot(dirX, dirY) || 1;
                        target.applyKnockback(dirX / dist, dirY / dist, projectile.knockback.force, projectile.knockback.duration);
                    }
                    projectile.collided = true;
                    break; 
                }
            }

            // 투사체 vs 장애물
            if (projectile.collided) continue;
            for (const obstacle of this.obstacles) {
                if (projectile.x > obstacle.x && projectile.x < obstacle.x + obstacle.width &&
                    projectile.y > obstacle.y && projectile.y < obstacle.y + obstacle.height)
                {
                    projectile.collided = true;
                    break;
                }
            }
        }

        // 자동공격 vs 타겟
        for (const owner of owners) {
            for (const autoAttack of owner.ownedAutoAttacks) {
                const canDamage = (performance.now() - autoAttack.lastDamageTimestamp) / 1000 >= autoAttack.damageCooldown;
                if (!canDamage) continue;

                if (autoAttack.name === 'Orbiting Sphere') {
                    for (const sphere of autoAttack.spheres) {
                        const sphereX = autoAttack.owner.x + Math.cos(sphere.angle) * autoAttack.orbitRadius;
                        const sphereY = autoAttack.owner.y + Math.sin(sphere.angle) * autoAttack.orbitRadius;

                        for (const target of targets) {
                            if (autoAttack.owner === target) continue; // 자기 자신은 피해를 입지 않음
                            const dx = sphereX - target.x;
                            const dy = sphereY - target.y;
                            const distance = Math.sqrt(dx * dx + dy * dy);

                            if (distance < 8 + target.size / 2) { // 8 is the sphere radius
                                target.takeDamage(autoAttack.damage);
                                target.applyStun(1.0); // 1초 스턴 효과 추가
                                autoAttack.lastDamageTimestamp = performance.now();
                                // 현재 구체는 하나의 대상만 공격하므로 내부 루프를 빠져나갑니다.
                                // 하지만 다른 구체나 다른 캐릭터의 공격은 계속 검사해야 하므로 함수를 완전히 종료하지 않습니다.
                                break; // return; 에서 break; 로 수정
                            }
                        }
                    }
                }
            }
        }
    }

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
        this.enemies.push(new Enemy(x, y, size, speed, 'crimson', 30));
    }
}