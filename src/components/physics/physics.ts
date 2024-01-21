import { Debug } from '@/util/debug'
import * as ex from 'excalibur'

export class PhysicsComponent extends ex.Component {
  declare owner: ex.Actor

  type = 'physics'
  debug = true
  gravity = ex.vec(0, 0)

  maxClimbAngle = ex.toRadians(80)

  origins!: RaycastOrigins
  collisions = new CollisionInfo()

  skinWidth = 1
  horizontalRayCount = 4
  verticalRayCount = 4

  private horizontalRaySpacing = 0
  private verticalRaySpacing = 0

  onAdd(owner: typeof this.owner): void {
    super.onAdd?.(owner)
    this.updateRaycastOrigins()
    this.calculateRaySpacing()
  }

  move(vel: ex.Vector) {
    this.updateRaycastOrigins()
    this.calculateRaySpacing()
    this.collisions.reset()

    if (vel.x !== 0) {
      this.horizontalCollisions(vel)
    }

    if (vel.y !== 0) {
      this.verticalCollisions(vel)
    }
  }

  verticalCollisions(vel: ex.Vector) {
    this.updateRaycastOrigins()

    const dirY = Math.sign(vel.y)
    let rayLength = Math.abs(vel.y) + this.skinWidth

    for (let i = 0; i < this.verticalRayCount; i++) {
      const rayOrigin =
        dirY === -1
          ? this.origins.topLeft.clone()
          : this.origins.bottomLeft.clone()

      rayOrigin.x += i * this.verticalRaySpacing + vel.x

      const ray = new ex.Ray(rayOrigin, ex.vec(0, dirY))
      const [hit] = this.cast(ray, {
        maxDistance: rayLength,
      })

      if (this.debug) {
        Debug.drawRay(this.owner, ray, rayLength)
      }

      if (hit) {
        vel.y = (hit.distance - this.skinWidth) * dirY
        rayLength = hit.distance

        // handle vertical collisions while climbing slopes
        if (this.collisions.climbingSlope) {
          vel.x =
            (-vel.y / Math.tan(this.collisions.slopeAngle)) * Math.sign(vel.x)
        }

        this.collisions[dirY === -1 ? 'top' : 'bottom'] = true
      }
    }
  }

  horizontalCollisions(vel: ex.Vector) {
    this.updateRaycastOrigins()

    const dirX = Math.sign(vel.x)
    let rayLength = Math.abs(vel.x) + this.skinWidth

    for (let i = 0; i < this.horizontalRayCount; i++) {
      const rayOrigin =
        dirX === -1
          ? this.origins.bottomLeft.clone()
          : this.origins.bottomRight.clone()

      rayOrigin.y -= i * this.horizontalRaySpacing

      const ray = new ex.Ray(rayOrigin, ex.vec(dirX, 0))
      const [hit] = this.cast(ray, {
        maxDistance: rayLength,
      })

      if (this.debug) {
        Debug.drawRay(this.owner, ray, rayLength)
      }

      if (hit) {
        const getAngle = (v1: ex.Vector, v2: ex.Vector) =>
          Math.acos(v1.dot(v2) / (v1.size * v2.size))

        const slopeAngle = getAngle(hit.normal, ex.Vector.Up)

        if (i === 0 && slopeAngle <= this.maxClimbAngle) {
          let distanceToSlopeStart = 0
          if (slopeAngle !== this.collisions.slopeAngleOld) {
            distanceToSlopeStart = hit.distance - this.skinWidth
            vel.x -= distanceToSlopeStart * dirX
          }
          this.climbSlope(vel, slopeAngle)
          vel.x += distanceToSlopeStart * dirX
        }

        if (!this.collisions.climbingSlope || slopeAngle > this.maxClimbAngle) {
          vel.x = (hit.distance - this.skinWidth) * dirX
          rayLength = hit.distance

          // handle horizontal collisions while climbing slopes
          if (this.collisions.climbingSlope) {
            vel.y = -Math.tan(this.collisions.slopeAngle) * Math.abs(vel.x)
          }

          this.collisions[dirX === -1 ? 'left' : 'right'] = true
        }
      }
    }
  }

  climbSlope(vel: ex.Vector, slopeAngle: number) {
    const moveDistance = Math.abs(vel.x)
    const climbVelocityY = Math.sin(slopeAngle) * moveDistance

    if (vel.y <= climbVelocityY) {
      vel.y = -climbVelocityY
      vel.x = Math.cos(slopeAngle) * moveDistance * Math.sign(vel.x)
      this.collisions.bottom = true
      this.collisions.slopeAngle = slopeAngle
    }
  }

  calculateRaySpacing() {
    this.horizontalRayCount = ex.clamp(this.horizontalRayCount, 2, Infinity)
    this.verticalRayCount = ex.clamp(this.verticalRayCount, 2, Infinity)

    this.horizontalRaySpacing =
      this.bounds.height / (this.horizontalRayCount - 1)
    this.verticalRaySpacing = this.bounds.width / (this.verticalRayCount - 1)
  }

  updateRaycastOrigins() {
    const bottomLeft = ex.vec(this.bounds.left, this.bounds.bottom)
    const topLeft = ex.vec(this.bounds.left, this.bounds.top)
    const bottomRight = ex.vec(this.bounds.right, this.bounds.bottom)
    const topRight = ex.vec(this.bounds.right, this.bounds.top)

    this.origins = new RaycastOrigins(
      topLeft,
      topRight,
      bottomLeft,
      bottomRight,
    )
  }

  get bounds() {
    return new ex.BoundingBox(
      this.owner.collider.bounds.left + this.skinWidth,
      this.owner.collider.bounds.top + this.skinWidth,
      this.owner.collider.bounds.right - this.skinWidth,
      this.owner.collider.bounds.bottom - this.skinWidth,
    )
  }

  cast = (
    ray: ex.Ray,
    {
      exclude,
      ...opts
    }: ex.RayCastOptions & { exclude?: Array<{ body: ex.BodyComponent }> },
  ) => {
    const hits = this.owner.scene.physics.rayCast(ray, {
      searchAllColliders: true,
      collisionGroup: this.owner.body.group,
      ...opts,
    })

    const excludedBodies = exclude?.map((e) => e.body)
    return hits.filter(
      ({ body }) => !excludedBodies?.includes(body) && body !== this.owner.body,
    )
  }
}

class RaycastOrigins {
  constructor(
    public topLeft: ex.Vector,
    public topRight: ex.Vector,
    public bottomLeft: ex.Vector,
    public bottomRight: ex.Vector,
  ) {}
}

class CollisionInfo {
  top = false
  bottom = false
  left = false
  right = false

  slopeAngle = 0
  slopeAngleOld = 0

  reset() {
    this.top = false
    this.bottom = false
    this.left = false
    this.right = false

    this.slopeAngleOld = this.slopeAngle
    this.slopeAngle = 0
  }

  get climbingSlope() {
    return this.slopeAngle !== 0
  }
}
