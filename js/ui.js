import { gameState, playerWorld } from './main.js';

const shopOverlay = document.getElementById('shop-overlay');
const shopContainer = document.getElementById('shop-container');

shopOverlay.addEventListener('click', (e) => {
    if (e.target === shopOverlay) {
        toggleShop(null);
    }
});

export function toggleShop(shopType) {
    const wasPaused = gameState.isPaused;
    if ((wasPaused && shopContainer.dataset.shopType === shopType) || !shopType) {
        gameState.isPaused = false;
        shopOverlay.classList.add('hidden');
        shopContainer.innerHTML = '';
        shopContainer.dataset.shopType = '';
    } else {
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
            title = '장비 상점';
            content = getWeaponShopHTML() + getItemShopHTML(); // 무기와 방어구 HTML을 합침
            break;
        case 'x':
            title = '스킬';
            content = getSkillShopHTML();
            break;
        case 'c':
            title = '조합';
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

    document.querySelectorAll('.upgrade-weapon-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const weaponKey = e.target.dataset.weaponKey;
            const player = playerWorld.character;
            const weapon = player.availableAutoAttacks[weaponKey];
            const cost = 25 + weapon.level * 25;

            if (player.spendGold(cost)) {
                weapon.upgrade();
                if (weapon.level === 1) {
                    player.ownedAutoAttacks.push(weapon);
                }
                renderShopContent('z');
                playerWorld.draw();
            }
        });
    });

    document.querySelectorAll('.upgrade-skill-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const skillKey = e.target.dataset.skillKey;
            const player = playerWorld.character;
            const skill = player.skills[skillKey];
            const cost = 10 + (skill.level - 1) * 15;

            if (player.spendGold(cost)) {
                player.upgradeSkill(skillKey);
                renderShopContent('x');
                playerWorld.draw();
            }
        });
    });

    document.querySelectorAll('.upgrade-item-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const itemKey = e.target.dataset.itemKey;
            const player = playerWorld.character;
            const item = player.availableItems[itemKey];
            const cost = 15 + item.level * 20;

            if (player.spendGold(cost)) {
                item.upgrade();
                renderShopContent('z'); // 'c'에서 'z'로 변경하여 장비 상점을 새로고침
                playerWorld.draw();
            }
        });
    });
}

function getWeaponShopHTML() {
    const player = playerWorld.character;
    let html = '<h3>무기</h3><div style="display: flex; flex-direction: column; gap: 15px;">';

    for (const [key, weapon] of Object.entries(player.availableAutoAttacks)) {
        const cost = 25 + weapon.level * 25;
        const nextLevelDescription = weapon.getNextLevelDescription ? weapon.getNextLevelDescription() : 'Max Level';
        
        let buttonHTML;
        if (weapon.level >= 21) {
            buttonHTML = `<span style="color: #888;">Max Level</span>`;
        } else {
            const buttonText = weapon.level === 0 ? `Buy (${cost} G)` : `Upgrade (${cost} G)`;
            buttonHTML = `<button class="upgrade-weapon-btn" data-weapon-key="${key}" style="padding: 10px 15px; cursor: pointer;">${buttonText}</button>`;
        }

        html += `
            <div style="background: #2a2a2a; padding: 10px; border-radius: 5px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h4 style="margin: 0 0 5px 0;">${weapon.name} (Lv. ${weapon.level})</h4>
                    <p style="margin: 0; font-size: 14px; color: #aaa;">
                        Current: ${weapon.level > 0 ? weapon.getDescription() : 'Not owned'}
                        <br>
                        <span style="color: lightgreen;">Next Lv: ${nextLevelDescription}</span>
                    </p>
                </div>
                ${buttonHTML}
            </div>
        `;
    }

    html += '</div>';
    return html;
}

function getItemShopHTML() {
    const player = playerWorld.character;
    let html = '<h3 style="margin-top: 30px;">방어구</h3><div style="display: flex; flex-direction: column; gap: 15px;">';

    for (const [key, item] of Object.entries(player.availableItems)) {
        const cost = 15 + item.level * 20;
        const nextLevelDescription = item.getNextLevelDescription ? item.getNextLevelDescription() : 'Max Level';

        let buttonHTML;
        if (item.level >= 21) {
            buttonHTML = `<span style="color: #888;">Max Level</span>`;
        } else {
            const buttonText = item.level === 0 ? `Buy (${cost} G)` : `Upgrade (${cost} G)`;
            buttonHTML = `<button class="upgrade-item-btn" data-item-key="${key}" style="padding: 10px 15px; cursor: pointer;">${buttonText}</button>`;
        }

        html += `
            <div style="background: #2a2a2a; padding: 10px; border-radius: 5px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h4 style="margin: 0 0 5px 0;">${item.name} (Lv. ${item.level})</h4>
                    <p style="margin: 0; font-size: 14px; color: #aaa;">
                        Current: ${item.level > 0 ? item.getDescription() : 'Not owned'}
                        <br>
                        <span style="color: lightgreen;">Next Lv: ${nextLevelDescription}</span>
                    </p>
                </div>
                ${buttonHTML}
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
        const cost = 10 + (skill.level - 1) * 15;
        const nextLevelDescription = skill.getNextLevelDescription ? skill.getNextLevelDescription() : 'Max Level';

        let buttonHTML;
        if (skill.level >= 21) {
            buttonHTML = `<span style="color: #888;">Max Level</span>`;
        } else {
            buttonHTML = `<button class="upgrade-skill-btn" data-skill-key="${key}" style="padding: 10px 15px; cursor: pointer;">Upgrade (${cost} G)</button>`;
        }

        html += `
            <div style="background: #2a2a2a; padding: 10px; border-radius: 5px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h4 style="margin: 0 0 5px 0;">${skill.name} (Lv. ${skill.level})</h4>
                    <p style="margin: 0; font-size: 14px; color: #aaa;">
                        Current: ${skill.getDescription ? skill.getDescription() : 'No description'}
                        <br>
                        <span style="color: lightgreen;">Next Lv: ${nextLevelDescription}</span>
                    </p>
                </div>
                ${buttonHTML}
            </div>
        `;
    }

    html += '</div>';
    return html;
}