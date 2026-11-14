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

  private val gearLazy: Lazy<GearMonitor> = lazy {
    requireAutomotive()
    GearMonitor(context) { gear ->
      // P 가 아니게 되거나 기어를 모르게 되면(차량 서비스 재시작 포함) 움직이던 시트를 바로 멈춘다.
      // DriverSeat 도 위치가 바뀔 때마다 기어를 보지만, 위치 알림이 끊기면 시간 초과(30초)까지 기다리게 된다.
      if (gear != "park" && seatLazy.isInitialized()) seat.stopAllBlocking(0)
      sendEvent("onGearChanged", mapOf("gear" to gear))
    }
  }
  private val gear: GearMonitor by gearLazy

  private val uxLazy = lazy {
    requireAutomotive()
    UxRestrictionsMonitor(context) { sendEvent("onUxRestrictionsChanged", it) }
  }
  private val ux by uxLazy

  private val vehicleLazy = lazy {
    requireAutomotive()
    Vehicle(context).apply { initialize() }
  }

  private val seatLazy: Lazy<DriverSeat> = lazy {
    DriverSeat(
      vehicleLazy.value.getSeat(),
      gear,
      onOccupancyChanged = { occupied -> sendEvent("onDriverSeatOccupancyChanged", mapOf("occupied" to occupied)) },
      onPositionChanged = { axis, value ->
        sendEvent("onDriverSeatPositionChanged", mapOf("axis" to axis.value, "value" to value))
      },
    )
  }
  private val seat: DriverSeat by seatLazy

  // 운전석 온도 취향(열선·공조). 값을 바꾸는 것은 주차 중 화면 조작으로만 한다.
  private val comfortLazy = lazy {
    val vehicle = vehicleLazy.value
    DriverComfort(
      vehicle.getSeat(),
      vehicle.getSteeringWheel(),
      vehicle.getHVAC(),
      vehicle.getSideMirror(),
      vehicle.getLight(),
      gear,
    )
  }
  private val comfort by comfortLazy

  private val voiceLazy = lazy {
    requireAutomotive()
    VoiceServices(context, PleosCredentials.from(context))
  }
  private val voice by voiceLazy

  private val naviLazy = lazy { NaviEvents(context) { sendEvent("onDestinationArrived", mapOf<String, Any?>()) } }

  private companion object {
    const val STOP_TIMEOUT_MS = 1_000L
  }

  override fun definition() =
    ModuleDefinition {
      Name("PleosConnect")

      Events(
        "onGearChanged",
        "onUxRestrictionsChanged",
        "onDriverSeatOccupancyChanged",
        "onDriverSeatPositionChanged",
        "onDestinationArrived",
        "onSpeechPartial",
      )

      Function("isAutomotive") { isAutomotive }

      AsyncFunction("getGear") Coroutine { -> gear.current() }

      AsyncFunction("getUxRestrictions") Coroutine { -> ux.current() }

      AsyncFunction("getDriverSeatState") Coroutine { -> seat.readState() }

      AsyncFunction("moveDriverSeatAxis") Coroutine { axis: SeatAxis, target: Int -> seat.moveTo(axis, target) }

      AsyncFunction("stopDriverSeat") Coroutine { -> seat.stopAll() }

      AsyncFunction("isDriverSeatOccupied") Coroutine { -> seat.isOccupied() }

      AsyncFunction("getDriverComfortState") Coroutine { -> comfort.readState() }

      AsyncFunction("applyDriverComfort") Coroutine { settings: ComfortSettings -> comfort.apply(settings) }

      // 목적지까지 남은 거리·시간만 넘긴다 (좌표·이름은 넘기지 않는다). 차량이 아니거나 목적지가 없으면 null.
      AsyncFunction("getNaviRoute") Coroutine { -> if (isAutomotive) naviLazy.value.readRoute() else null }

      AsyncFunction("listen") Coroutine { ->
        voice.listen { partial -> sendEvent("onSpeechPartial", mapOf("text" to partial)) }
      }

      AsyncFunction("stopListening") { if (voiceLazy.isInitialized()) voice.stopListening() }

      AsyncFunction("speak") Coroutine { text: String -> voice.speak(text) }

      OnStartObserving("onGearChanged") { if (isAutomotive) gear.startObserving() }
      OnStopObserving("onGearChanged") { if (gearLazy.isInitialized()) gear.stopObserving() }

      OnStartObserving("onUxRestrictionsChanged") { if (isAutomotive) ux.startObserving() }
      OnStopObserving("onUxRestrictionsChanged") { if (uxLazy.isInitialized()) ux.stopObserving() }

      OnStartObserving("onDriverSeatOccupancyChanged") { if (isAutomotive) seat.startOccupancyObserving() }
      OnStopObserving("onDriverSeatOccupancyChanged") { if (seatLazy.isInitialized()) seat.stopOccupancyObserving() }

      OnStartObserving("onDriverSeatPositionChanged") { if (isAutomotive) seat.startPositionObserving() }
      OnStopObserving("onDriverSeatPositionChanged") { if (seatLazy.isInitialized()) seat.stopPositionObserving() }

      OnStartObserving("onDestinationArrived") { if (isAutomotive) naviLazy.value.start() }
      OnStopObserving("onDestinationArrived") { if (naviLazy.isInitialized()) naviLazy.value.stop() }

      // Pleos 앱 구조 가이드: 백그라운드로 가면 즉시 중단할 수 있는 작업을 정리한다.
      // 멈추기 버튼이 보이지 않는 동안 시트가 움직이거나 마이크가 열려 있지 않게 한다.
      OnActivityEntersBackground {
        if (seatLazy.isInitialized()) seat.stopAllBlocking(0)
        if (voiceLazy.isInitialized()) voice.stopAll()
      }

      OnDestroy {
        if (naviLazy.isInitialized()) naviLazy.value.stop()
        if (voiceLazy.isInitialized()) voice.release()
        if (seatLazy.isInitialized()) {
          // 시트가 움직이는 중일 수 있다. Vehicle 을 해제하기 전에 반드시 멈춘다.
          seat.stopAllBlocking(STOP_TIMEOUT_MS)
          seat.stopOccupancyObserving()
          seat.stopPositionObserving()
        }
        if (vehicleLazy.isInitialized()) vehicleLazy.value.release()
        if (gearLazy.isInitialized()) gear.release()
        if (uxLazy.isInitialized()) ux.release()
      }
    }
}
