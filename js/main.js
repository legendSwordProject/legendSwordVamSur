import { World } from './world.js';
import { Obstacle } from './entities.js';
import { toggleShop } from './ui.js';

// --- 1. Setup ---
const playerCanvas = document.getElementById('playerCanvas');
const aiCanvas = document.getElementById('aiCanvas');
const gameContainer = document.getElementById('game-container');
const duelContainer = document.getElementById('duel-container');
const duelCanvas = document.getElementById('duelCanvas');

const openingOverlay = document.getElementById('opening-overlay');
const titleScreen = document.getElementById('title-screen');
const nameInputScreen = document.getElementById('name-input-screen');
const playerNameInput = document.getElementById('player-name-input');
const factionSelectScreen = document.getElementById('faction-select-screen');
const startGameButton = document.getElementById('start-game-button');
const factionButtons = document.querySelectorAll('.faction-button');

export const gameState = {
    isPaused: false,
    isGameRunning: false,
    phase: 'laning', // 'laning' or 'dueling'
    phaseTimer: 1, // 1초로 변경하여 즉시 결투장으로 이동
    currentRound: 1,
};
export const keys = {}; // Global state for keyboard input
export const mouse = { x: 0, y: 0 }; // Global state for mouse position

let playerName = "Player"; // Default name

// --- Event Listeners ---
playerCanvas.addEventListener('mousemove', (e) => {
    const rect = playerCanvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
});
document.addEventListener('keydown', (e) => {
    if (!e.key) return;
    keys[e.key.toLowerCase()] = true;
});
document.addEventListener('keyup', (e) => {
    if (!e.key) return;
    const key = e.key.toLowerCase();
    keys[key] = false;

    // 스킬 키를 뗄 때 발동 로직
    if (playerWorld && playerWorld.character.aimingSkillKey === key) {
        playerWorld.character.releaseSkill(key, duelWorld?.characters[1]);
    }

    if (['z', 'x', 'c'].includes(key) && !gameState.isPaused) {
        toggleShop(key);
    } else if (key === 'escape') {
        if (gameState.isPaused) {
            toggleShop(null);
        }
    }
});

startGameButton.addEventListener('click', () => {
    titleScreen.classList.add('hidden');
    nameInputScreen.classList.remove('hidden');
    factionSelectScreen.classList.remove('hidden');
    playerNameInput.focus();
});

factionButtons.forEach(button => {
    button.addEventListener('click', (e) => {
        playerName = playerNameInput.value.trim() || "Player";
        const selectedFaction = e.target.dataset.faction;
        // console.log(`Faction selected: ${selectedFaction}`);
        openingOverlay.classList.add('hidden');
        startGame();
    });
});

// --- Game Loop ---
export let playerWorld;
export let aiWorld;
export let duelWorld;
let lastTime = 0;

function gameLoop(timestamp) {
    requestAnimationFrame(gameLoop);
    if (!gameState.isGameRunning) return;

    if (!gameState.isPaused) {
        // deltaTime은 게임이 실행 중일 때만 계산하고 사용합니다.
        const deltaTime = (timestamp - lastTime) / 1000;

        if (gameState.phase === 'laning') {
            if (playerWorld) playerWorld.update(deltaTime);
            if (aiWorld) aiWorld.update(deltaTime);

            // Update phase timer
            gameState.phaseTimer -= deltaTime;
            if (gameState.phaseTimer <= 0) {
                transitionToDuel();
            }
        } else if (gameState.phase === 'dueling') {
            if (duelWorld) duelWorld.update(deltaTime);
            // Check for duel end condition
            const player = duelWorld.characters[0];
            const ai = duelWorld.characters[1];
            
            const isPlayerDead = player.isDead();
            const isAiDead = ai.isDead();

            if (isPlayerDead || isAiDead) {
                // 결투 종료: 패배한 캐릭터에게 리스폰 타이머를 설정하고 즉시 본진으로 전환합니다.
                const winner = isPlayerDead ? ai : player;
                const defeatedCharacter = isPlayerDead ? player : ai;
                
                winner.wonRounds.push(gameState.currentRound);
                gameState.currentRound++;
                // console.log(`${winner.name} has won round ${gameState.currentRound - 1}!`);
                defeatedCharacter.respawnTimer = 10; // 패배자만 10초 리스폰 타이머 설정

                if (winner.wonRounds.length >= 3) {
                    endGame(winner);
                } else {
                    transitionToLaning(); // 즉시 본진으로 이동
                }
            }
        }
        // 게임 로직이 실행된 후에만 lastTime을 갱신합니다.
        lastTime = timestamp;
    } else {
        // 일시정지 상태일 때는 lastTime만 갱신하여 deltaTime 누적을 방지합니다.
        lastTime = timestamp;
    }    
    // Drawing logic based on phase
    if (gameState.phase === 'laning') {
        if (playerWorld) playerWorld.draw();
        if (aiWorld) aiWorld.draw();
    } else if (gameState.phase === 'dueling') {
        if (duelWorld) duelWorld.draw();
    }
}

function transitionToDuel() {
    // console.log("Transitioning to Duel Phase!");
    gameState.phase = 'dueling';

    // Hide laning canvases and show duel canvas
    gameContainer.classList.add('hidden');
    duelContainer.classList.remove('hidden');

    // Create a new world for the duel
    duelWorld = new World(duelCanvas, false, 'Duel Field');
    duelWorld.isDuel = true;

    // 결투장에 2개 또는 4개의 장애물을 무작위로 대칭 배치합니다.
    const canvasWidth = duelCanvas.width;
    const canvasHeight = duelCanvas.height;
    const numObstaclePairs = Math.floor(Math.random() * 2) + 1; // 1 또는 2개의 쌍 (총 2개 또는 4개)
    const margin = 150; // 플레이어 스폰 지역 및 가장자리 여유 공간

    for (let i = 0; i < numObstaclePairs; i++) {
        // 장애물의 무작위 크기
        const width = Math.random() * 100 + 20; // 20 ~ 120
        const height = Math.random() * 100 + 20; // 20 ~ 120

        // 왼쪽 절반 영역 내에서 무작위 위치
        const x = Math.random() * (canvasWidth / 2 - width - margin) + margin;
        const y = Math.random() * (canvasHeight - height - margin * 2) + margin;

        // 대칭 쌍으로 장애물 추가
        // 왼쪽 장애물
        duelWorld.obstacles.push(new Obstacle(x, y, width, height));
        // 오른쪽 장애물 (대칭)
        const mirrorX = canvasWidth - x - width;
        duelWorld.obstacles.push(new Obstacle(mirrorX, y, width, height));
    }


    // Transfer characters from their old worlds to the new duel world
    // We need to re-parent them and position them
    playerWorld.character.world = duelWorld;
    aiWorld.character.world = duelWorld;
    playerWorld.character.x = 100; // Left side
    aiWorld.character.x = duelCanvas.width - 100; // Right side

    // The duel world now manages both characters
    duelWorld.character = null; // The duel world doesn't have a single primary character
    duelWorld.characters = [playerWorld.character, aiWorld.character];

    // Clear out enemies from the old worlds
    playerWorld.enemies = [];
    aiWorld.enemies = [];
}

function transitionToLaning() {
    // console.log("Transitioning back to Laning Phase!");
    gameState.phase = 'laning';
    gameState.phaseTimer = 120; // 타이머 리셋

    // 캔버스 가시성 복구
    duelContainer.classList.add('hidden');
    gameContainer.classList.remove('hidden');

    // 각 캐릭터를 원래 월드로 복귀
    playerWorld.character.world = playerWorld;
    aiWorld.character.world = aiWorld;

    // 두 캐릭터 모두 체력을 최대로 회복합니다.
    // 패배한 캐릭터의 리스폰 타이머는 gameLoop에서 설정되어 유지됩니다.
    playerWorld.character.reset();
    aiWorld.character.reset();

    // 두 캐릭터 모두 위치는 중앙으로 재설정
    playerWorld.character.x = playerWorld.canvas.width / 2;
    aiWorld.character.x = aiWorld.canvas.width / 2;

}

function startGame() {
    gameState.isGameRunning = true;
    playerWorld = new World(playerCanvas, true, playerName);
    aiWorld = new World(aiCanvas, false, "AI Opponent");
    lastTime = performance.now();

    // 개발자 콘솔에서 쉽게 접근하기 위해 window 객체에 할당합니다.
    window.playerWorld = playerWorld;
}

function endGame(winner) {
    gameState.isGameRunning = false;
    gameState.isPaused = true;

    // 기존 오버레이가 있다면 제거
    const existingOverlay = document.getElementById('victory-overlay');
    if (existingOverlay) {
        existingOverlay.remove();
    }

    // 승리 오버레이 생성
    const victoryOverlay = document.createElement('div');
    victoryOverlay.id = 'victory-overlay';
    victoryOverlay.className = 'opening-overlay'; // opening-overlay의 스타일 재사용
    victoryOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
    victoryOverlay.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
            <h1 style="color: gold;">Victory!</h1>
            <h2 style="color: white; text-align: center;">${winner.name} is the champion!</h2>
            <button id="restart-button" style="margin-top: 30px; padding: 15px 30px; font-size: 24px; cursor: pointer; background-color: #4CAF50; color: white; border: none; border-radius: 5px;">
                다시 시작
            </button>
        </div>
    `;
    document.body.appendChild(victoryOverlay);

    // '다시 시작' 버튼 이벤트 리스너 추가
    document.getElementById('restart-button').addEventListener('click', () => {
        victoryOverlay.remove(); // 오버레이 제거
        resetGame(); // 게임 초기화 및 다시 시작
    });
}

function resetGame() {
    // 게임 상태 초기화
    gameState.isPaused = false;
    gameState.isGameRunning = false;
    gameState.phase = 'laning';
    gameState.phaseTimer = 1;
    gameState.currentRound = 1;

    // 캐릭터 및 월드 객체 초기화 (새로 생성)
    playerWorld = null;
    aiWorld = null;
    duelWorld = null;

    // UI 초기화 (필요하다면)
    gameContainer.classList.remove('hidden');
    duelContainer.classList.add('hidden');

    // 시작 화면으로 돌아가거나 바로 게임 시작
    // 여기서는 바로 게임을 다시 시작하도록 합니다.
    startGame();
}

requestAnimationFrame(gameLoop);