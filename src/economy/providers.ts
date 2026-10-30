// Where real payments and rewarded adverts plug in. Neither is connected yet:
// the app needs a payment provider (for India, for example Razorpay or Google
// Play / App Store billing) and an ad network from the owner. Until then the
// demo providers below are used and every screen says so. At go-live a real
// purchase must also be confirmed by the club server before anything is granted.

export interface PaymentProvider {
  /** True while no real provider is connected: nothing is charged. */
  demo: boolean;
  /** Take payment for a product; resolves true once paid. */
  purchase(sku: string, inr: number): Promise<boolean>;
}

export interface AdProvider {
  demo: boolean;
  /** Show one rewarded advert; resolves true if it was watched to the end. */
  showRewarded(): Promise<boolean>;
}

/** The demo: the purchase sheet itself asks the player to confirm, and nothing is charged. */
const demoPayments: PaymentProvider = { demo: true, purchase: async () => true };
/** The demo advert is the placeholder sheet in ui/economySheets.ts. */
const demoAds: AdProvider = { demo: true, showRewarded: async () => true };

let payments = demoPayments;
let ads = demoAds;

export const paymentProvider = () => payments;
export const adProvider = () => ads;
export const setPaymentProvider = (p: PaymentProvider) => void (payments = p);
export const setAdProvider = (a: AdProvider) => void (ads = a);
