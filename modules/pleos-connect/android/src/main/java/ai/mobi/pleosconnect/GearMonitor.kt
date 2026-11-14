package ai.mobi.pleosconnect

import android.car.Car
import android.car.VehicleGear
import android.car.VehiclePropertyIds
import android.car.hardware.CarPropertyValue
import android.car.hardware.property.CarPropertyManager
import android.content.Context

// Pleos Vehicle SDK 의 Gear API 는 deprecated("use the Google GEAR_SELECTION property") 라서 Android Car API 를 쓴다.
// 일반 Android 기기에는 android.car 클래스 자체가 없다. 이 클래스는 차량(FEATURE_AUTOMOTIVE)에서만 만든다 (PleosConnectModule).
class GearMonitor(
  context: Context,
  private val onChanged: (String) -> Unit,
) {
  @Volatile
  private var observing = false

  private val callback = object : CarPropertyManager.CarPropertyEventCallback {
    override fun onChangeEvent(value: CarPropertyValue<*>) {
      (value.value as? Int)?.let { onChanged(toJsGear(it)) }
    }

    override fun onErrorEvent(propertyId: Int, areaId: Int) = Unit
  }

  // 차량 서비스에 연결되지 않은 동안은 기어를 모른다: JS 에 unknown 을 알리고, isParked() 는 false 가 된다(시트 이동 중이면 멈춘다).
  private val connection: CarConnection<CarPropertyManager> =
    CarConnection(
      context,
      Car.PROPERTY_SERVICE,
      CarPropertyManager::class.java,
      onConnected = {
        if (observing) runCatching { register() }
        runCatching { onChanged(current()) }
      },
      onLost = { onChanged("unknown") },
    )

  fun current(): String =
    toJsGear(connection.manager().getIntProperty(VehiclePropertyIds.GEAR_SELECTION, GLOBAL_AREA))

  // 확인할 수 없으면 주차가 아닌 것으로 본다 (안전 쪽으로 실패).
  fun isParked(): Boolean = runCatching { current() == "park" }.getOrDefault(false)

  @Synchronized
  fun startObserving() {
    if (observing) return
    // 아직 연결되지 않았으면 연결되는 순간(onConnected) 등록한다.
    observing = true
    runCatching { register() }
  }

  @Synchronized
  fun stopObserving() {
    if (!observing) return
    @Suppress("DEPRECATION")
    connection.currentOrNull()?.let { runCatching { it.unregisterCallback(callback) } }
    observing = false
  }

  fun release() {
    stopObserving()
    connection.disconnect()
  }

  private fun register() {
    @Suppress("DEPRECATION")
    connection.manager().registerCallback(
      callback,
      VehiclePropertyIds.GEAR_SELECTION,
      CarPropertyManager.SENSOR_RATE_ONCHANGE,
    )
  }

  private fun toJsGear(gear: Int): String =
    when (gear) {
      VehicleGear.GEAR_PARK -> "park"
      VehicleGear.GEAR_REVERSE -> "reverse"
      VehicleGear.GEAR_NEUTRAL -> "neutral"
      VehicleGear.GEAR_UNKNOWN -> "unknown"
      // D 와 수동 1~9단은 모두 주행 중으로 본다.
      else -> "drive"
    }

  private companion object {
    const val GLOBAL_AREA = 0
  }
}
