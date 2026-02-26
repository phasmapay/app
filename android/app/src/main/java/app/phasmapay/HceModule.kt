package app.phasmapay

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

class HceModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "HceModule"

    @ReactMethod
    fun startEmulation(solanaPayUrl: String, promise: Promise) {
        try {
            HceService.setPaymentUrl(solanaPayUrl)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("HCE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun stopEmulation(promise: Promise) {
        try {
            HceService.clear()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("HCE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun isEmulating(promise: Promise) {
        promise.resolve(HceService.isActive)
    }
}
