package ai.mobi.pleosconnect

import ai.pleos.playground.vehicle.api.HVAC
import ai.pleos.playground.vehicle.api.Seat
import ai.pleos.playground.vehicle.api.SteeringWheel
import ai.pleos.playground.vehicle.api.model.area.SeatArea
import ai.pleos.playground.vehicle.api.model.capability.AccessType
import ai.pleos.playground.vehicle.api.model.capability.AreaBounds
import ai.pleos.playground.vehicle.api.model.capability.CapabilityConfig
import ai.pleos.playground.vehicle.api.model.capability.HvacTemperatureConfigArray
import ai.pleos.playground.vehicle.constant.area.SeatValue
import ai.pleos.playground.vehicle.constant.unit.TemperatureUnit
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import kotlin.math.roundToInt

// 운전석 온도 취향: 시트 열선(통풍), 핸들 열선, 운전석 공조 설정 온도, 지금 실내 온도.
// 값의 범위·단계는 차종마다 달라서 원시 값과 범위를 함께 넘기고, JS 는 범위 안에서만 다룬다.
// 열선 값은 AAOS 규약대로 음수 = 통풍(냉각), 0 = 꺼짐, 양수 = 열선 단계다.
class ComfortSettings : Record {
  @Field var seatHeat: Int? = null

  @Field var steeringHeat: Int? = null

  @Field var cabinTarget: Double? = null
}

class DriverComfort(
  private val seat: Seat,
  private val steering: SteeringWheel,
  private val hvac: HVAC,
  private val gear: GearMonitor,
) {
  private val driver = SeatArea(SeatValue.ROW_1_LEFT)

  // 차량마다 지원하는 항목이 다르다. 읽을 수 없는 항목은 결과에서 뺀다.
  suspend fun readState(): Map<String, Any> {
    val state = mutableMapOf<String, Any>()
    orNull { seatHeatRange() }?.let { range ->
      orNull { seatHeat() }?.let { state["seatHeat"] = level(it, range) }
    }
    orNull { steeringHeatRange() }?.let { range ->
      orNull { steeringHeat() }?.let { state["steeringHeat"] = level(it, range) }
    }
    orNull { cabinTargetRange() }?.let { (area, range) ->
      orNull { cabinTarget(area) }?.let {
        state["cabinTarget"] =
          mapOf("value" to it.toDouble(), "min" to range.start.toDouble(), "max" to range.endInclusive.toDouble())
      }
      orNull { cabinCurrent(area) }?.let { state["cabinCurrent"] = it.toDouble() }
    }
    return state
  }

  // 주차(P) 중에 화면에서 운전자가 누를 때만 쓴다. 기어를 알 수 없으면 바꾸지 않는다.
  // 범위 밖 값은 차량 범위로 맞춰 보낸다. 바꾼 뒤의 상태를 돌려준다.
  suspend fun apply(settings: ComfortSettings): Map<String, Any> {
    if (!gear.isParked()) throw NotParkedException()
    settings.seatHeat?.let { wanted ->
      val range = seatHeatRange() ?: throw PleosServiceException("이 차량은 시트 열선을 지원하지 않습니다")
      suspendPleos<Unit> { resume, fail ->
        seat.setHvacSeatTemperature(
          driver,
          wanted.coerceIn(range),
          { _: SeatArea?, _: Int? -> resume(Unit) },
          { e: Throwable? -> fail(e) },
        )
      }
    }
    settings.steeringHeat?.let { wanted ->
      val range = steeringHeatRange() ?: throw PleosServiceException("이 차량은 핸들 열선을 지원하지 않습니다")
      suspendPleos<Unit> { resume, fail ->
        steering.setHvacSteeringWheelHeat(
          wanted.coerceIn(range),
          { _: Int? -> resume(Unit) },
          { e: Throwable? -> fail(e) },
        )
      }
    }
    settings.cabinTarget?.let { wanted ->
      val (area, range) = cabinTargetRange() ?: throw PleosServiceException("이 차량은 공조 온도 설정을 지원하지 않습니다")
      suspendPleos<Unit> { resume, fail ->
        hvac.setHvacTemperature(
          area,
          wanted.toFloat().coerceIn(range),
          TemperatureUnit.CELSIUS,
          { _: SeatArea?, _: Float? -> resume(Unit) },
          { e: Throwable? -> fail(e) },
        )
      }
    }
    return readState()
  }

  private suspend fun seatHeat(): Int? =
    suspendPleos { resume, fail ->
      seat.getHvacSeatTemperature(driver, { value: Int? -> resume(value) }, { e: Throwable? -> fail(e) })
    }

  private suspend fun seatHeatRange(): IntRange? =
    suspendPleos { resume, fail ->
      seat.checkSeatTemperatureCapabilities(
        { config: CapabilityConfig?, areas: Map<out SeatArea?, AreaBounds<*>?>? ->
          resume(if (config.isReadable()) intRange(areas?.entries?.firstOrNull { it.key.isDriver() }?.value) else null)
        },
        { e: Throwable? -> fail(e) },
      )
    }

  private suspend fun steeringHeat(): Int? =
    suspendPleos { resume, fail ->
      steering.getHvacSteeringWheelHeatState({ value: Int? -> resume(value) }, { e: Throwable? -> fail(e) })
    }

  private suspend fun steeringHeatRange(): IntRange? =
    suspendPleos { resume, fail ->
      steering.checkHvacSteeringWheelHeatCapabilities(
        { config: CapabilityConfig?, bounds: AreaBounds<*>? ->
          resume(if (config.isReadable()) intRange(bounds) else null)
        },
        { e: Throwable? -> fail(e) },
      )
    }

  // 공조 구역은 차종마다 다르다 (운전석 단독 구역이 없으면 앞좌석 전체 구역). 운전석이 든 구역을 고른다.
  private suspend fun cabinTargetRange(): Pair<SeatArea, ClosedFloatingPointRange<Float>>? =
    suspendPleos { resume, fail ->
      hvac.checkHvacTemperatureCapabilities(
        // 2.3.2 에서 두 인자 버전은 deprecated. 설정 단계 정보(세 번째 인자)는 쓰지 않는다.
        { config: CapabilityConfig?, areas: Map<out SeatArea?, AreaBounds<*>?>?, _: HvacTemperatureConfigArray? ->
          val entry =
            areas?.entries?.firstOrNull { it.key.isDriver() } ?: areas?.entries?.firstOrNull()
          val area = entry?.key
          val a = (entry?.value?.minValue as? Number)?.toFloat()
          val b = (entry?.value?.maxValue as? Number)?.toFloat()
          resume(
            if (config.isReadable() && area != null && a != null && b != null) area to minOf(a, b)..maxOf(a, b) else null,
          )
        },
        { e: Throwable? -> fail(e) },
      )
    }

  private suspend fun cabinTarget(area: SeatArea): Float? =
    suspendPleos { resume, fail ->
      hvac.getHvacTemperature(
        area,
        TemperatureUnit.CELSIUS,
        { value: Float? -> resume(value) },
        { e: Throwable? -> fail(e) },
      )
    }

  private suspend fun cabinCurrent(area: SeatArea): Float? =
    suspendPleos { resume, fail ->
      hvac.getHvacTemperatureCurrent(
        area,
        TemperatureUnit.CELSIUS,
        { value: Float? -> resume(value) },
        { e: Throwable? -> fail(e) },
      )
    }

  private fun level(value: Int, range: IntRange) =
    mapOf("value" to value, "min" to range.first, "max" to range.last)

  private fun intRange(bounds: AreaBounds<*>?): IntRange? {
    val a = (bounds?.minValue as? Number)?.toDouble()?.roundToInt() ?: return null
    val b = (bounds.maxValue as? Number)?.toDouble()?.roundToInt() ?: return null
    return minOf(a, b)..maxOf(a, b)
  }

  private fun SeatArea?.isDriver(): Boolean = this?.values?.contains(SeatValue.ROW_1_LEFT) == true

  private fun CapabilityConfig?.isReadable(): Boolean = this?.accessType != AccessType.NONE
}
