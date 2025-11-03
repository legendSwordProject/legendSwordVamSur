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
                skill.upgrade();
                renderShopContent('x');
                playerWorld.draw();
            }
        });
    });
}

function getWeaponShopHTML() {
    const player = playerWorld.character;
    let html = '<div style="display: flex; flex-direction: column; gap: 15px;">';

    for (const [key, weapon] of Object.entries(player.availableAutoAttacks)) {
        const cost = 25 + weapon.level * 25;
        const buttonText = weapon.level === 0 ? `Buy (${cost} G)` : `Upgrade (${cost} G)`;
        html += `
            <div style="background: #2a2a2a; padding: 10px; border-radius: 5px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h4 style="margin: 0 0 5px 0;">${weapon.name} (Lv. ${weapon.level})</h4>
                    <p style="margin: 0; font-size: 14px; color: #aaa;">
                        ${weapon.level > 0 ? weapon.getDescription() : 'Not owned'}
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
        const cost = 10 + (skill.level - 1) * 15;
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