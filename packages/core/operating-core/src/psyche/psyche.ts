export interface BigFive {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

export interface BehaviorContract {
  traits: string[];
  guidelines: string[];
}

export interface Psyche {
  personality: BigFive;
  behavior: BehaviorContract;
}
