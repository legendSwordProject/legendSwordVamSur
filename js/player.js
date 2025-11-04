import { AoeSkill, ProjectileSkill, DashSkill, PassiveHpSkill } from './skills.js';
import { OrbitingSphere, EightWayShot } from './autoAttacks.js';
import { Armor } from './items.js';
import { keys, gameState } from './main.js';

const imageCache = {};
function loadImage(src) {
    if (!src) return null;
    if (imageCache[src]) {
        return imageCache[src];
    }
    const img = new Image();
    img.src = src;
    imageCache[src] = img;
    return img;
}

export class Player {
    constructor(x, y, color, world, name) {
        this.x = x;
        this.y = y;
        this.size = 20;
        this.baseSpeed = 200;
        this.speed = this.baseSpeed;
        this.color = color;
        this.world = world;
        this.name = name;
        this.isPlayerControlled = world.isPlayerWorld; // 자신이 플레이어인지 기억

        this.baseMaxHp = 100;
        this.maxHp = this.baseMaxHp;
        this.hp = this.maxHp;
        this.respawnTimer = 0;
        this.stunTimer = 0;
        this.isInvincible = false;
        this.invincibilityTimer = 0;

        this.defense = 0;
        // 넉백 상태 변수
        this.knockbackTimer = 0;
        this.knockbackForce = 0;
        this.knockbackDirection = { x: 0, y: 0 };

        // 대쉬 상태 변수
        this.isDashing = false;
        this.dashTimer = 0;
        this.dashSpeed = 0;
        this.dashDirection = { x: 0, y: 0 };
        this.speedBuffTimer = 0;

        this.aimingSkillKey = null; // 조준 중인 스킬 키 (예: 'q')
        this.aiAimingTimer = 0; // AI가 스킬을 조준하는 시간
        this.gold = 0;
        this.nextSkillToUpgrade = 0;

        this.skills = {
            'q': new AoeSkill(this, 5, 'Q', 'Blast', 100, 10),
            'w': new ProjectileSkill(this, 1, 'W', 'Shot', 1300, 5),
            'e': new DashSkill(this, 8, 'E', 'Dash', 1200, 0.15),
            'r': new PassiveHpSkill(this, 'R', 'Toughness', 5),
        };

        this.availableAutoAttacks = {
            'orbitingSphere': new OrbitingSphere(this),
            'eightWayShot': new EightWayShot(this),
        };
        this.availableItems = {
            'armor': new Armor(this, 'Armor'),
        };

        this.ownedAutoAttacks = [];
        this.recalculateStats(); // 초기 스탯 계산
    }

    update(deltaTime, opponent) {
        // 스킬 쿨타임은 항상 업데이트합니다. (부활 중에도)
        Object.values(this.skills).forEach(skill => skill.update(deltaTime));

        // 무적 타이머 업데이트
        if (this.invincibilityTimer > 0) {
            this.invincibilityTimer -= deltaTime;
            if (this.invincibilityTimer <= 0) {
                this.isInvincible = false;
            }
        }

        // 속도 버프 타이머 업데이트
        if (this.speedBuffTimer > 0) {
            this.speedBuffTimer -= deltaTime;
            if (this.speedBuffTimer <= 0) {
                this.speed = this.baseSpeed; // 버프가 끝나면 기본 속도로 복원
            }
        }

        if (this.stunTimer > 0) {
            this.stunTimer -= deltaTime;
            // 스턴 상태에서는 아무것도 하지 않고, 스턴 시각 효과를 추가할 수 있습니다.
            return;
        }

        // 넉백 처리
        if (this.knockbackTimer > 0) {
            const moveDistance = this.knockbackForce * deltaTime;
            this.move(this.knockbackDirection.x, this.knockbackDirection.y, moveDistance);

            this.knockbackForce *= 0.9; // 마찰력으로 서서히 감속
            this.knockbackTimer -= deltaTime;
            // 넉백 중에는 다른 이동 로직을 건너뜁니다.
            return;
        }

        if (this.respawnTimer > 0) {
            this.respawnTimer -= deltaTime;
            return; // Do nothing while respawning
        }

        // 대쉬 중일 경우, 대쉬 움직임만 처리
        if (this.isDashing) {
            this.handleDashing(deltaTime);
            // 대쉬 중에는 다른 업데이트 로직을 건너뜁니다.
            return;
        }

        // AI가 스킬을 조준 중일 때 처리
        if (!this.isPlayerControlled && this.aimingSkillKey) {
            this.aiAimingTimer -= deltaTime;
            if (this.aiAimingTimer <= 0) {
                this.releaseSkill(this.aimingSkillKey, opponent);
            }
            // 조준 중에는 다른 AI 로직을 건너뜁니다.
            return;
        }

        if (this.isPlayerControlled) {
            this.handlePlayerInput(deltaTime, opponent);
        } else {
            this.handleAI(deltaTime, opponent);
        }

        this.x = Math.max(this.size / 2, Math.min(this.world.canvas.width - this.size / 2, this.x));
        this.y = Math.max(this.size / 2, Math.min(this.world.canvas.height - this.size / 2, this.y));
    }
    
    checkObstacleCollision(nextX, nextY) {
        for (const obstacle of this.world.obstacles) {
            // Check collision with obstacle
            if (nextX - this.size / 2 < obstacle.x + obstacle.width &&
                nextX + this.size / 2 > obstacle.x &&
                nextY - this.size / 2 < obstacle.y + obstacle.height &&
                nextY + this.size / 2 > obstacle.y) {
                return obstacle; // Collision detected
            }
        }
        return null; // No collision
    }

    handlePlayerInput(deltaTime, opponent) {
        const speed = this.speed * deltaTime;
        let moveX = 0;
        let moveY = 0;
        if (keys['arrowup']) moveY -= 1;
        if (keys['arrowdown']) moveY += 1;
        if (keys['arrowleft']) moveX -= 1;
        if (keys['arrowright']) moveX += 1;

        this.move(moveX, moveY, speed);

        // 'q' 키를 누르고 있으면 조준 상태로 설정
        if (keys['q']) {
            if (this.skills['q']?.canUse()) {
                this.aimingSkillKey = 'q';
            }
        } else {
            // 키를 떼면 조준 상태 해제 (keyup 이벤트에서도 처리하지만 안전장치)
            if (this.aimingSkillKey === 'q') {
                this.releaseSkill('q', opponent);
            }
        }

        if (keys['w']) this.skills['w']?.use(this.world, opponent, deltaTime);
        if (keys['e']) this.skills['e']?.use(this.world, opponent);
        // 'r' 키는 패시브이므로 입력 처리 없음
    }

    releaseSkill(key, opponent) {
        this.skills[key]?.use(this.world, opponent);
        this.aimingSkillKey = null;
    }

    upgradeSkill(key) {
        const skill = this.skills[key];
        if (skill) {
            skill.upgrade();
            // 패시브 효과가 있는 스킬이 업그레이드되었을 수 있으므로 스탯을 다시 계산합니다.
            this.recalculateStats();
        }
    }

    handleAI(deltaTime, opponent) {
        const speed = this.speed * deltaTime;        
        // 1.5 AI Upgrade Logic
        const orbitingSphere = this.availableAutoAttacks['orbitingSphere'];
        const sphereCost = 25 + orbitingSphere.level * 25;

        // Priority 1: Buy Orbiting Sphere if not owned
        if (orbitingSphere.level === 0) {
            if (this.gold >= sphereCost) {
                if (this.spendGold(sphereCost)) {
                    orbitingSphere.upgrade();
                    this.ownedAutoAttacks.push(orbitingSphere);
                    console.log(`AI Purchased ${orbitingSphere.name}`);
                }
            }
        } else { // Priority 2: Alternate between upgrading skills and sphere
            if (this.nextSkillToUpgrade % 2 === 0) { // Upgrade a skill
                const skillKeys = Object.keys(this.skills);

                if (skillKeys.length > 0) {
                    const keyToUpgrade = skillKeys[Math.floor(this.nextSkillToUpgrade / 2) % skillKeys.length];
                    const cost = 10 + (this.skills[keyToUpgrade].level - 1) * 15;

                    if (this.gold >= cost) {
                        if (this.spendGold(cost)) {
                            this.upgradeSkill(keyToUpgrade);
                            console.log(`AI Upgraded ${this.skills[keyToUpgrade].name} to level ${this.skills[keyToUpgrade].level}`);
                            this.nextSkillToUpgrade++;
                        }
                    }
                }
            } else { // Upgrade the sphere
                if (this.gold >= sphereCost) {
                    if (this.spendGold(sphereCost)) {
                        orbitingSphere.upgrade();
                        console.log(`AI Upgraded ${orbitingSphere.name} to level ${orbitingSphere.level}`);
                        this.nextSkillToUpgrade++;
                    }
                }
            }
        }

        // 2. AI Movement (Avoidance & Patrolling)
        const panicDistance = 100;
        let nearestThreat = null;

        if (this.world.isDuel) {
            nearestThreat = opponent;
        } else {
            nearestThreat = this.world.findNearestEnemy(this);
        }

        // AI 스킬 사용 로직
        Object.values(this.skills).forEach(skill => {
            if (!skill.canUse() || !nearestThreat || this.aimingSkillKey) return;

            // DashSkill(대쉬)은 특별한 전략적 판단을 통해 사용
            if (skill instanceof DashSkill) {
                const hpPercent = this.hp / this.maxHp;
                const aoeSkill = this.skills['q'];
                const dx = this.x - nearestThreat.x;
                const dy = this.y - nearestThreat.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                // 1. 후퇴: 체력이 35% 미만이면 적으로부터 멀어지는 방향으로 대쉬
                if (hpPercent < 0.35) {
                    skill.use(this.world, opponent, deltaTime);
                    return; // 대쉬를 사용했으면 다른 스킬 판단은 건너뜀
                }

                // 2. 돌진: Q스킬이 있고, 사용 가능하며, 상대가 Q스킬 사거리 바로 바깥에 있을 때
                if (aoeSkill && aoeSkill.canUse() && distance > aoeSkill.radius && distance < aoeSkill.radius + 200) {
                    skill.use(this.world, opponent, deltaTime);
                    return;
                }
                return; // 대쉬 조건이 아니면 사용하지 않음
            }

            // AoeSkill(근접 스킬)은 타겟이 범위 안에 있을 때만 사용
            if (skill instanceof AoeSkill) {
                const dx = this.x - nearestThreat.x;
                const dy = this.y - nearestThreat.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                // AI가 스킬 범위를 판단할 때 약간의 오차를 추가합니다.
                // errorMargin 값만큼 AI가 실제 스킬 범위보다 넓거나 좁게 인식할 수 있습니다.
                const errorMargin = 40; // (px)
                const perceivedRadius = skill.radius + (Math.random() - 0.5) * errorMargin;

                if (distance <= perceivedRadius) {
                    this.aimingSkillKey = 'q';
                    this.aiAimingTimer = 0.1; // 0.5초 동안 조준
                    return; // 조준을 시작했으면 다른 스킬 판단은 건너뜀
                }
            } 
            // 다른 스킬(예: ProjectileSkill)은 쿨타임이 되면 바로 사용
            else {
                if (this.world.isDuel) {
                    skill.use(this.world, opponent, deltaTime);
                } else {
                    skill.use(this.world, null, deltaTime);
                }
            }
        });

        let moveX = 0;
        let moveY = 0;

        if (nearestThreat) {
            const dx = this.x - nearestThreat.x;
            const dy = this.y - nearestThreat.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            const aoeSkill = this.skills['q'];
            let forwardBack = 0; // -1 (후퇴), 0 (유지), 1 (전진)
            let strafe = 0; // -1 (왼쪽), 0 (정지), 1 (오른쪽)

            if (this.world.isDuel) {
                const kiteDistance = 350;
                const attackDistance = aoeSkill ? aoeSkill.radius * 0.8 : 80;

                // 상태 결정: Q 스킬이 준비되면 공격 모드, 아니면 카이팅 모드
                if (aoeSkill && aoeSkill.canUse()) { // 공격 모드
                    if (dist > attackDistance) forwardBack = 1; // 접근
                } else { // 카이팅 모드
                    if (dist < kiteDistance) forwardBack = -1; // 후퇴
                    else if (dist > kiteDistance + 50) forwardBack = 1; // 접근
                }

                // 주기적으로 측면 이동 방향 변경
                strafe = Math.sin(performance.now() / 700) > 0 ? 1 : -1;

                // 최종 이동 벡터 계산
                const forwardVecX = -dx / dist;
                const forwardVecY = -dy / dist;
                const strafeVecX = -forwardVecY;
                const strafeVecY = forwardVecX;

                // 주 이동 벡터 계산
                moveX = (forwardVecX * forwardBack) + (strafeVecX * strafe);
                moveY = (forwardVecY * forwardBack) + (strafeVecY * strafe);

                // 장애물 회피 로직 추가
                const avoidanceForce = this.getObstacleAvoidanceForce();
                moveX += avoidanceForce.x * 2.0; // 회피력을 더함
                moveY += avoidanceForce.y * 2.0;
                
                const moveMagnitude = Math.sqrt(moveX * moveX + moveY * moveY);
                if (moveMagnitude > 0) {
                    moveX /= moveMagnitude;
                    moveY /= moveMagnitude;
                }

            } else { // 본진에서는 회피만
                if (dist < panicDistance) {
                    moveX = dx / dist;
                    moveY = dy / dist;
                }
            }
        }

        if (!this.world.isDuel && moveX === 0 && moveY === 0) {
            const time = performance.now() / 1000;
            const targetX = this.world.canvas.width / 2 + Math.cos(time) * 80;
            const targetY = this.world.canvas.height / 2 + Math.sin(time) * 80;
            const dx = targetX - this.x;
            const dy = targetY - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 1) {
                moveX = dx / dist;
                moveY = dy / dist;
            }
        }

        this.move(moveX, moveY, speed);
    }

    getObstacleAvoidanceForce() {
        const avoidance = { x: 0, y: 0 };
        const avoidanceRadius = this.size * 3; // 장애물을 감지할 반경

        for (const obstacle of this.world.obstacles) {
            const closestX = Math.max(obstacle.x, Math.min(this.x, obstacle.x + obstacle.width));
            const closestY = Math.max(obstacle.y, Math.min(this.y, obstacle.y + obstacle.height));

            const dx = this.x - closestX;
            const dy = this.y - closestY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < avoidanceRadius) {
                const force = (avoidanceRadius - distance) / avoidanceRadius;
                avoidance.x += (dx / distance) * force;
                avoidance.y += (dy / distance) * force;
            }
        }
        return avoidance;
    }

    startDash(dashSpeed, dashDuration, deltaTime, opponent) {
        if (this.isDashing) return;

        this.isDashing = true;
        this.dashSpeed = dashSpeed;
        this.dashTimer = dashDuration;

        // 대쉬 시 0.5초간 무적 효과
        this.isInvincible = true;
        this.invincibilityTimer = 0.7;

        let dirX = 0;
        let dirY = 0;

        // 플레이어는 이동키 또는 마우스 방향으로 대쉬
        if (this.isPlayerControlled) {
            if (keys['arrowup']) dirY -= 1;
            if (keys['arrowdown']) dirY += 1;
            if (keys['arrowleft']) dirX -= 1;
            if (keys['arrowright']) dirX += 1;

            // 이동 입력이 없으면 마우스 커서 방향으로 대쉬
            if (dirX === 0 && dirY === 0) {
                dirX = mouse.x - this.x;
                dirY = mouse.y - this.y;
            }
        } else {
            // AI는 현재 이동 방향으로 대쉬 (handleAI에서 계산된 방향)
            // handleAI에서 계산된 moveX, moveY를 사용합니다.
            const aiMove = this.calculateAIMovement(deltaTime, this.world.isDuel ? opponent : null);
            dirX = aiMove.moveX;
            dirY = aiMove.moveY;
        }

        const magnitude = Math.sqrt(dirX * dirX + dirY * dirY);
        if (magnitude > 0) {
            this.dashDirection.x = dirX / magnitude;
            this.dashDirection.y = dirY / magnitude;
        }
    }

    // AI의 이동 방향만 계산하는 헬퍼 함수
    calculateAIMovement(deltaTime, opponent) {
        let moveX = 0;
        let moveY = 0;

        const panicDistance = 100;
        let nearestThreat = null;

        if (this.world.isDuel) {
            nearestThreat = opponent;
        } else {
            nearestThreat = this.world.findNearestEnemy(this);
        }

        if (nearestThreat) {
            const dx = this.x - nearestThreat.x;
            const dy = this.y - nearestThreat.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (this.world.isDuel) {
                const aoeSkill = this.skills['q'];
                let forwardBack = 0;
                let strafe = 0;
                const kiteDistance = 350;
                const attackDistance = aoeSkill ? aoeSkill.radius * 0.8 : 80;

                if (aoeSkill && aoeSkill.canUse()) {
                    if (dist > attackDistance) forwardBack = 1;
                } else {
                    if (dist < kiteDistance) forwardBack = -1;
                    else if (dist > kiteDistance + 50) forwardBack = 1;
                }

                strafe = Math.sin(performance.now() / 700) > 0 ? 1 : -1;

                const forwardVecX = -dx / dist;
                const forwardVecY = -dy / dist;
                const strafeVecX = -forwardVecY;
                const strafeVecY = forwardVecX;

                moveX = (forwardVecX * forwardBack) + (strafeVecX * strafe);
                moveY = (forwardVecY * forwardBack) + (strafeVecY * strafe);

                const avoidanceForce = this.getObstacleAvoidanceForce();
                moveX += avoidanceForce.x * 2.0;
                moveY += avoidanceForce.y * 2.0;

                const moveMagnitude = Math.sqrt(moveX * moveX + moveY * moveY);
                if (moveMagnitude > 0) {
                    moveX /= moveMagnitude;
                    moveY /= moveMagnitude;
                }
            } else {
                if (dist < panicDistance) {
                    moveX = dx / dist;
                    moveY = dy / dist;
                }
            }
        }

        if (!this.world.isDuel && moveX === 0 && moveY === 0) {
            const time = performance.now() / 1000;
            const targetX = this.world.canvas.width / 2 + Math.cos(time) * 80;
            const targetY = this.world.canvas.height / 2 + Math.sin(time) * 80;
            const dx = targetX - this.x;
            const dy = targetY - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 1) {
                moveX = dx / dist;
                moveY = dy / dist;
            }
        }
        return { moveX, moveY };
    }

    move(moveX, moveY, speed) {
        if (moveX === 0 && moveY === 0) return;

        // 정규화하여 대각선 이동이 더 빠르지 않도록 함
        const magnitude = Math.sqrt(moveX * moveX + moveY * moveY);
        if (magnitude > 1) {
            moveX /= magnitude;
            moveY /= magnitude;
        }

        let nextX = this.x + moveX * speed;
        let nextY = this.y + moveY * speed;

        // X축 이동 후 충돌 검사
        if (!this.checkObstacleCollision(nextX, this.y)) {
            this.x = nextX;
        }
        // Y축 이동 후 충돌 검사
        if (!this.checkObstacleCollision(this.x, nextY)) {
            this.y = nextY;
        }
    }

    handleDashing(deltaTime) {
        this.dashTimer -= deltaTime;
        if (this.dashTimer <= 0) {
            this.isDashing = false;

            // 대쉬 종료 후 3초간 이동속도 50% 증가 버프
            this.speedBuffTimer = 3.0;
            this.speed = this.baseSpeed * 1.5;

            return;
        }

        const moveDistance = this.dashSpeed * deltaTime;
        const moveX = this.dashDirection.x;
        const moveY = this.dashDirection.y;

        // 대쉬는 장애물을 무시하지 않고, 부딪히면 멈춥니다.
        this.move(moveX, moveY, moveDistance);
    }

    takeDamage(damage) {
        if (this.isInvincible) return; // 무적 상태일 때는 데미지를 받지 않음

        const finalDamage = Math.max(1, damage - this.defense); // 최소 1의 데미지는 받도록 함
        this.hp -= finalDamage;
        console.log(`${this.name} took ${finalDamage} damage (Original: ${damage}), HP: ${this.hp}`);
    }

    applyStun(duration) {
        if (this.isInvincible) return; // 무적 상태일 때는 스턴에 걸리지 않음

        this.stunTimer = Math.max(this.stunTimer, duration); // 기존 스턴이 더 길면 유지
    }

    recalculateStats() {
        const oldMaxHp = this.maxHp;
        let newMaxHp = this.baseMaxHp;
        const hpSkill = this.skills['r'];

        if (hpSkill) {
            // 패시브 스킬 레벨에 따라 추가 체력을 계산합니다. (기본 1레벨 포함)
            const hpBonus = (hpSkill.level - 1) * hpSkill.hpPerLevel;
            newMaxHp += hpBonus;
        }

        // Dash 스킬 레벨에 따라 기본 이동속도 증가
        const dashSkill = this.skills['e'];
        let speedBonus = 0;
        if (dashSkill) {
            speedBonus = (dashSkill.level - 1) * dashSkill.speedPerLevel;
        }
        this.baseSpeed = 200 + speedBonus;
        // 버프 상태가 아니면 현재 속도도 업데이트
        if (this.speedBuffTimer <= 0) this.speed = this.baseSpeed;

        newMaxHp = Math.min(200, newMaxHp); // 최대 체력을 200으로 제한
        const hpIncrease = newMaxHp - oldMaxHp;

        this.maxHp = newMaxHp;
        if (hpIncrease > 0) {
            this.hp += hpIncrease; // 증가한 최대 체력만큼 현재 체력도 증가
        }
        this.hp = Math.min(this.hp, this.maxHp); // 안전장치: 현재 체력이 최대 체력을 넘지 않도록 함
    }

    applyKnockback(directionX, directionY, force, duration) {
        if (this.isInvincible) return; // 무적 상태일 때는 넉백에 걸리지 않음

        this.knockbackDirection.x = directionX;
        this.knockbackDirection.y = directionY;
        this.knockbackForce = force;
        this.knockbackTimer = duration;
        this.stunTimer = Math.max(this.stunTimer, duration / 2); // 넉백 중 짧은 경직
    }

    isDead() {
        return this.hp <= 0;
    }

    reset() {
        this.hp = this.maxHp;
        // 위치는 각 페이즈 전환 시 설정
    }

    addGold(amount) {
        this.gold += amount;
    }

    spendGold(amount) {
        if (this.gold >= amount) {
            this.gold -= amount;
            return true;
        }
        return false;
    }

    draw(ctx) {
        // Draw health text
        const hpText = `${Math.round(this.hp)} / ${this.maxHp}`;
        ctx.fillStyle = 'white';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(hpText, this.x, this.y - this.size / 2 - 8);

        // Draw character
        ctx.save();
        if (this.isInvincible) {
            ctx.globalAlpha = 0.5; // 무적 상태일 때 반투명 처리
        }
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Draw skill aiming indicator
        if (this.aimingSkillKey) {
            const skill = this.skills[this.aimingSkillKey];
            if (skill && skill.radius) {
                ctx.save();
                ctx.beginPath();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 10]);
                ctx.arc(this.x, this.y, skill.radius, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }
        }
    }

    drawSkillUI(ctx) {
        const iconSize = 50;
        const padding = 10;
        const allSkills = Object.entries(this.skills); // 모든 스킬을 포함
        const skillsWidth = allSkills.length * (iconSize + padding) - padding;

        let startX;
        let nameX, nameAlign;
        let goldX, goldAlign;

        if (gameState.phase === 'dueling') {
            // 결투장에서는 플레이어와 AI의 UI 위치를 좌/우로 나눔
            if (this.isPlayerControlled) {
                startX = (ctx.canvas.width / 2 - skillsWidth) / 2;
                nameX = ctx.canvas.width / 4;
                goldX = 10;
                goldAlign = 'left';
            } else {
                startX = ctx.canvas.width / 2 + (ctx.canvas.width / 2 - skillsWidth) / 2;
                nameX = ctx.canvas.width * 3 / 4;
                goldX = ctx.canvas.width - 10;
                goldAlign = 'right';
            }
        } else {
            // 본진에서는 각자 캔버스 중앙에 UI를 배치
            startX = (ctx.canvas.width - skillsWidth) / 2;
            nameX = ctx.canvas.width / 2;
            goldX = this.isPlayerControlled ? 10 : ctx.canvas.width - 10;
            goldAlign = this.isPlayerControlled ? 'left' : 'right';
        }

        const startY = ctx.canvas.height - iconSize - 20;

        allSkills.forEach(([key, skill], index) => { // 모든 스킬을 순회
            const x = startX + index * (iconSize + padding);
            const y = startY;

            // 아이콘 이미지 또는 기본 배경 그리기
            const iconImage = loadImage(skill.icon);
            if (iconImage && iconImage.complete && iconImage.naturalWidth !== 0) {
                ctx.drawImage(iconImage, x, y, iconSize, iconSize);
            } else {
                ctx.fillStyle = '#333';
                ctx.fillRect(x, y, iconSize, iconSize);
            }

            ctx.strokeStyle = skill.canUse() ? '#aaa' : '#888';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, iconSize, iconSize);

            // 패시브 스킬이 아닐 때만 단축키를 그립니다.
            if (!skill.isPassive) {
                ctx.fillStyle = 'white';
                ctx.font = 'bold 14px sans-serif';
                ctx.textAlign = 'right';
                ctx.fillText(key.toUpperCase(), x + iconSize - 5, y + iconSize - 5);
            }
            ctx.fillStyle = 'gold';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(`Lv.${skill.level}`, x + 4, y + 14);

            const cooldownProgress = skill.getCooldownProgress();
            if (cooldownProgress > 0) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.fillRect(x, y, iconSize, iconSize * cooldownProgress);

                const remainingTime = (skill.cooldown * cooldownProgress).toFixed(1);
                ctx.fillStyle = 'white';
                ctx.font = 'bold 20px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(remainingTime, x + iconSize / 2, y + iconSize / 2 + 8);
            }
        });

        ctx.fillStyle = 'gold';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = goldAlign;
        ctx.fillText(`Gold: ${this.gold}`, goldX, 30);

        // Draw Player Name at the top center
        ctx.fillStyle = 'white';
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(this.name, nameX, 30);

        // Draw Phase Timer
        if (gameState.phase === 'laning') {
            const minutes = Math.floor(gameState.phaseTimer / 60);
            const seconds = Math.floor(gameState.phaseTimer % 60);
            const timerText = `${minutes}:${seconds.toString().padStart(2, '0')}`;

            ctx.fillStyle = 'white';
            ctx.font = 'bold 22px sans-serif';
            if (this.world.isPlayerWorld) {
                ctx.textAlign = 'right';
                ctx.fillText(timerText, ctx.canvas.width - 15, ctx.canvas.height - 15);
            } else {
                ctx.textAlign = 'left';
                ctx.fillText(timerText, 15, ctx.canvas.height - 15);
            }
        }

        // Draw Respawn Timer if dead
        if (this.respawnTimer > 0) {
            const respawnText = `Respawning in ${Math.ceil(this.respawnTimer)}...`;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(0, ctx.canvas.height / 2 - 30, ctx.canvas.width, 60);
            ctx.fillStyle = 'red';
            ctx.font = 'bold 30px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(respawnText, ctx.canvas.width / 2, ctx.canvas.height / 2 + 10);
        }
    }
}