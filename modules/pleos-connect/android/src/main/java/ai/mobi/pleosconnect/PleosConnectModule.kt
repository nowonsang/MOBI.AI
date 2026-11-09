package ai.mobi.pleosconnect

import ai.pleos.playground.vehicle.Vehicle
import android.content.Context
import android.content.pm.PackageManager
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Pleos Connect SDK 를 JS 로 노출하는 브릿지. JS 쪽 계약은 src/PleosConnectModule.ts 와 맞춘다.
// SDK 클라이언트는 처음 쓸 때 만들고, 모듈이 내려갈 때 모두 해제한다.
class PleosConnectModule : Module() {
  private val context: Context
    get() = appContext.reactContext?.applicationContext ?: throw Exceptions.ReactContextLost()

  // 차량 여부는 android.car 클래스를 건드리기 전에 확인한다. 일반 Android 기기에는 그 클래스가 없어 앱이 멈춘다.
  private val isAutomotive: Boolean
    get() = context.packageManager.hasSystemFeature(PackageManager.FEATURE_AUTOMOTIVE)

  private fun requireAutomotive() {
    if (!isAutomotive) throw NotAutomotiveException()
  }

  private val gearLazy = lazy {
    requireAutomotive()
    GearMonitor(context) { sendEvent("onGearChanged", mapOf("gear" to it)) }
  }
  private val gear by gearLazy

  private val vehicleLazy = lazy {
    requireAutomotive()
    Vehicle(context).apply { initialize() }
  }

  private val seatLazy = lazy {
    DriverSeat(vehicleLazy.value.getSeat(), gear) { occupied ->
      sendEvent("onDriverSeatOccupancyChanged", mapOf("occupied" to occupied))
    }
  }
  private val seat by seatLazy

  private val voiceLazy = lazy {
    requireAutomotive()
    VoiceServices(context, PleosCredentials.from(context))
  }
  private val voice by voiceLazy

  private val naviLazy = lazy { NaviEvents(context) { sendEvent("onDestinationArrived", mapOf<String, Any?>()) } }

  override fun definition() =
    ModuleDefinition {
      Name("PleosConnect")

      Events("onGearChanged", "onDriverSeatOccupancyChanged", "onDestinationArrived", "onSpeechPartial")

      Function("isAutomotive") { isAutomotive }

      AsyncFunction("getGear") Coroutine { -> gear.current() }

      AsyncFunction("getDriverSeatState") Coroutine { -> seat.readState() }

      AsyncFunction("moveDriverSeatAxis") Coroutine { axis: SeatAxis, target: Int -> seat.moveTo(axis, target) }

      AsyncFunction("stopDriverSeat") Coroutine { -> seat.stopAll() }

      AsyncFunction("isDriverSeatOccupied") Coroutine { -> seat.isOccupied() }

      AsyncFunction("listen") Coroutine { ->
        voice.listen { partial -> sendEvent("onSpeechPartial", mapOf("text" to partial)) }
      }

      AsyncFunction("stopListening") { if (voiceLazy.isInitialized()) voice.stopListening() }

      AsyncFunction("speak") Coroutine { text: String -> voice.speak(text) }

      OnStartObserving("onGearChanged") { if (isAutomotive) gear.startObserving() }
      OnStopObserving("onGearChanged") { if (gearLazy.isInitialized()) gear.stopObserving() }

      OnStartObserving("onDriverSeatOccupancyChanged") { if (isAutomotive) seat.startOccupancyObserving() }
      OnStopObserving("onDriverSeatOccupancyChanged") { if (seatLazy.isInitialized()) seat.stopOccupancyObserving() }

      OnStartObserving("onDestinationArrived") { if (isAutomotive) naviLazy.value.start() }
      OnStopObserving("onDestinationArrived") { if (naviLazy.isInitialized()) naviLazy.value.stop() }

      OnDestroy {
        if (naviLazy.isInitialized()) naviLazy.value.stop()
        if (voiceLazy.isInitialized()) voice.release()
        if (seatLazy.isInitialized()) seat.stopOccupancyObserving()
        if (vehicleLazy.isInitialized()) vehicleLazy.value.release()
        if (gearLazy.isInitialized()) gear.release()
      }
    }
}
