# App Clip proof-of-concept

A minimal iOS app + App Clip showing that the Persona Band pre-order can run natively inside an App Clip with Apple Pay (deferred payment: authorized now, charged when it ships).

```bash
brew install xcodegen
xcodegen generate
open PersonaDemo.xcodeproj   # run the PersonaDemoClip scheme on an iOS 26 simulator
```

Setting `AUTO_PAY=1` in the scheme's environment presents the Apple Pay sheet on launch (used for automated screenshots). The merchant ID is a placeholder; real charges need a registered Apple Pay merchant and a payment processor.
