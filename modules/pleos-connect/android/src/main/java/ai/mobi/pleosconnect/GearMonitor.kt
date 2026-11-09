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
  private val context: Context,
  private val onChanged: (String) -> Unit,
) {
  private var car: Car? = null
  private var properties: CarPropertyManager? = null
  private var observing = false

  private val callback = object : CarPropertyManager.CarPropertyEventCallback {
    override fun onChangeEvent(value: CarPropertyValue<*>) {
      (value.value as? Int)?.let { onChanged(toJsGear(it)) }
    }

    override fun onErrorEvent(propertyId: Int, areaId: Int) = Unit
  }

  @Synchronized
  private fun manager(): CarPropertyManager {
    properties?.let { return it }
    val connected = Car.createCar(context) ?: throw NotAutomotiveException()
    car = connected
    return (connected.getCarManager(Car.PROPERTY_SERVICE) as CarPropertyManager)
      .also { properties = it }
  }

  fun current(): String =
    toJsGear(manager().getIntProperty(VehiclePropertyIds.GEAR_SELECTION, GLOBAL_AREA))

  // 확인할 수 없으면 주차가 아닌 것으로 본다 (안전 쪽으로 실패).
  fun isParked(): Boolean = runCatching { current() == "park" }.getOrDefault(false)

  fun startObserving() {
    if (observing) return
    @Suppress("DEPRECATION")
    manager().registerCallback(
      callback,
      VehiclePropertyIds.GEAR_SELECTION,
      CarPropertyManager.SENSOR_RATE_ONCHANGE,
    )
    observing = true
  }

  fun stopObserving() {
    if (!observing) return
    @Suppress("DEPRECATION")
    properties?.unregisterCallback(callback)
    observing = false
  }

  fun release() {
    stopObserving()
    car?.disconnect()
    car = null
    properties = null
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
