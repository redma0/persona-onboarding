import SwiftUI
import PassKit

@main
struct PersonaClip: App {
    var body: some Scene {
        WindowGroup { BandClipView() }
    }
}

struct BandClipView: View {
    @State private var qty = 1
    @State private var status: String?
    private let prices = [1: 179, 2: 338, 3: 477]

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Image("hero").resizable().scaledToFill().frame(height: 220).clipped()
                        .listRowInsets(EdgeInsets())
                }
                Section {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Persona Band").font(.largeTitle.bold())
                        Text("The world's smartest band.").foregroundStyle(.secondary)
                    }
                }
                Section {
                    Label("Pairs with the Persona app", systemImage: "iphone")
                    Label("Approve with a tap or voice", systemImage: "checkmark.circle")
                    Label("The LED ring shows it heard you", systemImage: "sun.max")
                    Label("Three days of battery", systemImage: "bolt")
                    Label("Privacy mode", systemImage: "lock")
                }
                Section("Quantity") {
                    Picker("Quantity", selection: $qty) {
                        ForEach([1, 2, 3], id: \.self) { n in Text("\(n)× · $\(prices[n]!)").tag(n) }
                    }
                    .pickerStyle(.inline).labelsHidden()
                }
                if let status {
                    Section { Label(status, systemImage: "checkmark.seal.fill").foregroundStyle(.green) }
                }
            }
            .task {
                // test hook: SIMCTL_CHILD_AUTO_PAY=1 presses the Apple Pay button on launch
                if ProcessInfo.processInfo.environment["AUTO_PAY"] == "1" {
                    try? await Task.sleep(for: .seconds(2))
                    await preorder()
                }
            }
            .navigationTitle("Pre-order")
            .navigationBarTitleDisplayMode(.inline)
            .safeAreaInset(edge: .bottom) {
                PayWithApplePayButton(.order) {
                    Task { await preorder() }
                }
                .frame(height: 52)
                .padding()
                .background(.bar)
            }
        }
    }

    /// Apple Pay pre-order: a deferred payment (authorize now, charge when it ships).
    func preorder() async {
        let total = NSDecimalNumber(value: prices[qty]!)
        let req = PKPaymentRequest()
        req.merchantIdentifier = "merchant.com.personademo"
        req.countryCode = "US"
        req.currencyCode = "USD"
        req.supportedNetworks = [.visa, .masterCard, .amex]
        req.merchantCapabilities = .threeDSecure
        req.requiredShippingContactFields = [.postalAddress, .name, .emailAddress]
        let item = PKDeferredPaymentSummaryItem(label: "Persona Band ×\(qty) (ships Dec 2026)", amount: total)
        item.deferredDate = Calendar.current.date(from: DateComponents(year: 2026, month: 12, day: 1))!
        req.paymentSummaryItems = [item, PKPaymentSummaryItem(label: "Persona", amount: total)]
        let deferred = PKDeferredPaymentRequest(
            paymentDescription: "Persona Band pre-order",
            deferredBilling: item,
            managementURL: URL(string: "https://yourpersona.com/band")!
        )
        req.deferredPaymentRequest = deferred

        let controller = PKPaymentAuthorizationController(paymentRequest: req)
        let delegate = PayDelegate { ok in status = ok ? "Pre-order placed · charged when it ships" : nil }
        controller.delegate = delegate
        PayDelegate.retain = delegate
        let shown = await controller.present()
        print("APPLEPAY_PRESENTED=\(shown) canMakePayments=\(PKPaymentAuthorizationController.canMakePayments())")
    }
}

final class PayDelegate: NSObject, PKPaymentAuthorizationControllerDelegate {
    nonisolated(unsafe) static var retain: PayDelegate?
    let done: @MainActor (Bool) -> Void
    private var ok = false
    init(done: @escaping @MainActor (Bool) -> Void) { self.done = done }

    func paymentAuthorizationController(_ c: PKPaymentAuthorizationController, didAuthorizePayment p: PKPayment) async -> PKPaymentAuthorizationResult {
        ok = true
        print("APPLEPAY_AUTHORIZED token_bytes=\(p.token.paymentData.count)")
        return PKPaymentAuthorizationResult(status: .success, errors: nil)
    }
    func paymentAuthorizationControllerDidFinish(_ c: PKPaymentAuthorizationController) {
        c.dismiss()
        let ok = ok
        Task { @MainActor in done(ok) }
    }
}
