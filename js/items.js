export class Item {
    constructor(owner, name) {
        this.owner = owner;
        this.name = name;
        this.level = 0;
    }

    upgrade() {
        this.level++;
        this.applyEffect();
    }

    applyEffect() {}
    getDescription() {}
}

export class Armor extends Item {
    applyEffect() {
        this.owner.defense = 5 + (this.level - 1) * 2;
    }
    getDescription() {
        return `Damage Reduction: ${this.owner.defense}`;
    }
    getNextLevelDescription() {
        const nextDefense = 5 + this.level * 2;
        return `Damage Reduction: ${nextDefense}`;
    }
}