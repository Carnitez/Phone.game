export interface IapProductDef {
  id: string;
  name: string;
  /** priceLabel is display-only — no store is wired up in the MVP. */
  priceLabel: string;
  kind: 'entitlement' | 'gems';
  gemAmount?: number;
}

export const IAP_PRODUCTS: IapProductDef[] = [
  { id: 'remove-ads-forever', name: 'Remove Ads Forever', priceLabel: '$4.99', kind: 'entitlement' },
  { id: 'gem-pack-small', name: 'Gem Pack (Small)', priceLabel: '$0.99', kind: 'gems', gemAmount: 50 },
  { id: 'gem-pack-medium', name: 'Gem Pack (Medium)', priceLabel: '$4.99', kind: 'gems', gemAmount: 250 },
  { id: 'gem-pack-large', name: 'Gem Pack (Large)', priceLabel: '$9.99', kind: 'gems', gemAmount: 600 },
  { id: 'cosmetic-theme', name: 'Cosmetic Habitat Theme', priceLabel: '$2.99', kind: 'entitlement' },
];
