import { characterService } from './characterService';

export type AxolotlSkinId = 'leucistic' | 'cyber' | 'golden' | 'lavender' | 'midnight' | 'starlight';
export type AxolotlAccessoryId = 'none' | 'glasses' | 'cap' | 'headphones' | 'halo' | 'crown' | 'bowtie' | 'snorkel';
export type AxolotlEnvironmentId = 'sanctuary-reef' | 'deep-biolum' | 'zen-pond' | 'cyber-matrix';
export type AxolotlMood = 'happy' | 'curious' | 'zen' | 'playful' | 'sleepy' | 'hungry';
export type AxolotlTreatType = 'shrimp' | 'berry' | 'bean' | 'pearl';

export interface AxolotlState {
  name: string;
  skin: AxolotlSkinId;
  accessory: AxolotlAccessoryId;
  environment: AxolotlEnvironmentId;
  mood: AxolotlMood;
  happiness: number;
  hunger: number;
  energy: number;
  friendshipLevel: number;
  friendshipXP: number;
  axonCoins: number;
  treatInventory: Record<AxolotlTreatType, number>;
  evolutionStage: 'hatchling' | 'juvenile' | 'adult' | 'celestial';
  totalPets: number;
  totalTreatsFed: number;
  unlockedSkins: AxolotlSkinId[];
  unlockedAccessories: AxolotlAccessoryId[];
}

class CompatibleMascotService {
  public getState(): AxolotlState {
    const c = characterService.getCharacter();
    return {
      name: c.name,
      skin: 'cyber',
      accessory: (c.headwear === 'mortarboard' ? 'cap' : c.headwear === 'headphones' ? 'headphones' : 'none') as AxolotlAccessoryId,
      environment: 'sanctuary-reef',
      mood: 'happy',
      happiness: c.happiness || 85,
      hunger: c.hunger || 80,
      energy: c.energy || 90,
      friendshipLevel: c.level || 1,
      friendshipXP: c.xp || 25,
      axonCoins: c.coins || 0,
      treatInventory: { shrimp: 5, berry: 10, bean: 8, pearl: 3 },
      evolutionStage: c.level >= 6 ? 'celestial' : c.level >= 3 ? 'adult' : 'juvenile',
      totalPets: 0,
      totalTreatsFed: 0,
      unlockedSkins: ['leucistic', 'cyber', 'golden'],
      unlockedAccessories: ['none', 'glasses', 'cap', 'headphones'],
    };
  }

  public subscribe(listener: (state: AxolotlState) => void): () => void {
    return characterService.subscribe(() => {
      listener(this.getState());
    });
  }

  public updateName(name: string) {
    characterService.updateName(name);
  }

  public setSkin(_skin: AxolotlSkinId) {
    // Skin mapped to character styling
  }

  public setAccessory(_acc: AxolotlAccessoryId) {
    // Accessory mapped to character styling
  }

  public setEnvironment(_env: AxolotlEnvironmentId) {
    // Environment mapped
  }

  public setMood(_mood: AxolotlMood) {
    characterService.setMood('happy');
  }

  public pet() {
    return characterService.motivate();
  }

  public feed(_treatType: AxolotlTreatType) {
    const res = characterService.feed('snack');
    return {
      hunger: res.hunger,
      happiness: res.happiness,
      xp: 20,
      leveledUp: false,
    };
  }

  public awardStudySessionRewards(cardsReviewed: number, durationMinutes: number = 5, accuracy: number = 0.85, skipCoins: boolean = false) {
    const res = characterService.awardStudySessionRewards(cardsReviewed, durationMinutes, accuracy, skipCoins);
    return {
      treatsEarned: { shrimp: 1, berry: 2, bean: 1, pearl: 1 },
      coinsEarned: res.coinsEarned,
      friendshipXPEarned: res.xpEarned,
      leveledUp: res.leveledUp,
    };
  }

  public addCoins(amount: number) {
    characterService.addCoins(amount);
  }

  public spendCoins(amount: number): boolean {
    return characterService.spendCoins(amount);
  }

  public buySkin(_skinId: AxolotlSkinId, price: number): boolean {
    return characterService.spendCoins(price);
  }

  public buyAccessory(_accId: AxolotlAccessoryId, price: number): boolean {
    return characterService.spendCoins(price);
  }

  public doTrick() {
    return characterService.doTrick();
  }
}

export const axolotlService = new CompatibleMascotService();
