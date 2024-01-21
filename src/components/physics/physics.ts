import { Actor } from '@/classes/actor'
import { Debug } from '@/util/debug'
import { getVecAngle } from '@/util/math'
import * as ex from 'excalibur'

export class PhysicsComponent extends ex.Component {
  declare owner: Actor

  type = 'physics'
  debug = true
  gravity = ex.vec(0, 0)

  maxClimbAngle = ex.toRadians(80)
  maxDescendAngle = ex.toRadians(80)

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

    if (vel.y > 0) {
      this.descendSlope(vel)
    }

    if (vel.x !== 0) {
      this.horizontalCollisions(vel)
    }

    if (vel.y !== 0) {
      this.verticalCollisions(vel)
    }
  }

  /**
   * Handles vertical collisions given the velocity. It will
   * cast the necessary rays and adjust the velocity to account
   * for the collision.
   */
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
        this.resolveCollision(hit, {
          resolve: (vel) => {
            // move up to the point of collision
            vel.y = (hit.distance - this.skinWidth) * dirY

            // handle vertical collisions while climbing slopes
            if (this.collisions.climbingSlope) {
              vel.x =
                (-vel.y / Math.tan(this.collisions.slopeAngle)) *
                Math.sign(vel.x)
            }

            return vel
          },
          postResolve: () => {
            // we've resolved a collision, so shorten the ray length
            // to only resolve the next collision if it is closer
            rayLength = hit.distance

            // update collision info
            this.collisions[dirY === -1 ? 'top' : 'bottom'] = true
          },
        })
      }
    }

    // check if we've encountered a new slope horizontally while climbing a slope
    // this will handle a change in angle on an existing slope, and make sure we don't overshoot
    // the x vel adjustment based on the current slope angle
    if (this.collisions.climbingSlope) {
      const dirX = Math.sign(vel.x)
      rayLength = Math.abs(vel.x) + this.skinWidth

      const rayOrigin =
        dirX === -1 ? this.origins.bottomLeft : this.origins.bottomRight

      rayOrigin.addEqual(ex.vec(0, vel.y))

      const ray = new ex.Ray(rayOrigin, ex.vec(dirX, 0))
      const [hit] = this.cast(ray, {
        maxDistance: rayLength,
      })

      if (hit) {
        const slopeAngle = getVecAngle(hit.normal, ex.Vector.Up)
        if (slopeAngle !== this.collisions.slopeAngle) {
          this.resolveCollision(hit, {
            resolve: (vel) => {
              vel.x = (hit.distance - this.skinWidth) * dirX

              return vel
            },
            postResolve: () => {
              this.collisions.slopeAngle = slopeAngle
            },
          })
        }
      }
    }
  }

  /**
   * Handles horizontal collisions given the velocity. It will
   * cast the necessary rays and adjust the velocity to account
   * for the collision.
   */
  horizontalCollisions(vel: ex.Vector) {
    this.updateRaycastOrigins()

    const dirX = Math.sign(vel.x)
    let rayLength = Math.abs(vel.x) + this.skinWidth

    for (let i = 0; i < this.horizontalRayCount; i++) {
      // raycast from the bottom left or right
      const rayOrigin =
        dirX === -1
          ? this.origins.bottomLeft.clone()
          : this.origins.bottomRight.clone()

      // adjust for which ray this is
      rayOrigin.y -= i * this.horizontalRaySpacing

      // do the raycast
      const ray = new ex.Ray(rayOrigin, ex.vec(dirX, 0))
      const [hit] = this.cast(ray, {
        maxDistance: rayLength,
      })

      if (this.debug) {
        Debug.drawRay(this.owner, ray, rayLength)
      }

      // resolve the collision
      if (hit) {
        const slopeAngle = getVecAngle(hit.normal, ex.Vector.Up)

        // if this is a climbable slope, climb it.
        // (only during the first ray since it is at the corner)
        if (i === 0 && slopeAngle <= this.maxClimbAngle) {
          let distanceToSlopeStart = 0

          this.resolveCollision(hit, {
            resolve: (vel) => {
              // we've hit a new slope - subtract from velocity.x the distance to the slope
              // so that we don't move into the slope before climbing
              if (slopeAngle !== this.collisions.slopeAngleOld) {
                distanceToSlopeStart = hit.distance - this.skinWidth
                vel.x -= distanceToSlopeStart * dirX
              }

              this.climbSlope(vel, slopeAngle)

              // we've finished climbing the slope for this frame, add back the distance we subtracted
              vel.x += distanceToSlopeStart * dirX

              return vel
            },
          })
        }

        if (!this.collisions.climbingSlope || slopeAngle > this.maxClimbAngle) {
          this.resolveCollision(hit, {
            resolve: (vel) => {
              vel.x = (hit.distance - this.skinWidth) * dirX

              // handle horizontal collisions while climbing slopes
              if (this.collisions.climbingSlope) {
                vel.y = -Math.tan(this.collisions.slopeAngle) * Math.abs(vel.x)
              }

              return vel
            },
            postResolve: () => {
              rayLength = hit.distance
              this.collisions[dirX === -1 ? 'left' : 'right'] = true
            },
          })
        }
      }
    }
  }

  /**
   * Modifies the velocity to climb a slope.
   */
  climbSlope(vel: ex.Vector, slopeAngle: number) {
    const moveDistance = Math.abs(vel.x)
    const climbVelocityY = -Math.sin(slopeAngle) * moveDistance

    if (vel.y >= climbVelocityY) {
      vel.y = climbVelocityY
      vel.x = Math.cos(slopeAngle) * moveDistance * Math.sign(vel.x)
      this.collisions.bottom = true
      this.collisions.slopeAngle = slopeAngle
      this.collisions.climbingSlope = true
    }
  }

  /**
   * Modifies the velocity to descend a slope.
   */
  descendSlope(vel: ex.Vector) {
    const dirX = Math.sign(vel.x)
    const rayOrigin =
      dirX === -1 ? this.origins.bottomRight : this.origins.bottomLeft

    const [hit] = this.cast(new ex.Ray(rayOrigin, ex.vec(0, 1)), {
      // this.cast will search all colliders so this isn't
      // very performant. cap it to 100px
      maxDistance: 100,
    })

    if (hit) {
      const slopeAngle = getVecAngle(hit.normal, ex.Vector.Up)
      if (slopeAngle !== 0 && slopeAngle <= this.maxDescendAngle) {
        if (Math.sign(hit.normal.x) === dirX) {
          if (
            hit.distance - this.skinWidth <=
            Math.tan(slopeAngle) * Math.abs(vel.x)
          ) {
            const moveDistance = Math.abs(vel.x)
            const descendVelocityY = Math.sin(slopeAngle) * moveDistance
            vel.x = Math.cos(slopeAngle) * moveDistance * Math.sign(vel.x)
            vel.y += descendVelocityY

            this.collisions.slopeAngle = slopeAngle
            this.collisions.descendingSlope = true
            this.collisions.bottom = true
          }
        }
      }
    }
  }

  /**
   * Calculates the spacing between rays based on the number of rays and the
   * size of the collider.
   */
  calculateRaySpacing() {
    this.horizontalRayCount = ex.clamp(this.horizontalRayCount, 2, Infinity)
    this.verticalRayCount = ex.clamp(this.verticalRayCount, 2, Infinity)

    this.horizontalRaySpacing =
      this.bounds.height / (this.horizontalRayCount - 1)
    this.verticalRaySpacing = this.bounds.width / (this.verticalRayCount - 1)
  }

  /**
   * Updates the raycast origins based on the collider bounds.
   */
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

  /**
   * Returns the collider bounds with the skin width removed.
   */
  get bounds() {
    return new ex.BoundingBox(
      this.owner.collider.bounds.left + this.skinWidth,
      this.owner.collider.bounds.top + this.skinWidth,
      this.owner.collider.bounds.right - this.skinWidth,
      this.owner.collider.bounds.bottom - this.skinWidth,
    )
  }

  /**
   * Casts a ray and returns all hits. It will exclude the owner
   * and any colliders in the exclude array.
   */
  cast(
    ray: ex.Ray,
    {
      exclude,
      ...opts
    }: ex.RayCastOptions & { exclude?: Array<{ body: ex.BodyComponent }> },
  ) {
    const hits = this.owner.scene.physics.rayCast(ray, {
      searchAllColliders: true,
      ...opts,
    })

    const excludedBodies = exclude?.map((e) => e.body)
    return (
      hits
        .filter(
          ({ body }) =>
            !excludedBodies?.includes(body) && body !== this.owner.body,
        )
        // sort by distance so that the closest hit is first
        .sort((a, b) => a.distance - b.distance)
    )
  }

  /**
   * Resolves a collision with a hit from a raycast, firing onPreCollisionResolve
   * and onPostCollisionResolve events. Collisions can be canceled during onPreCollisionResolve.
   */
  resolveCollision(
    hit: ex.RayCastHit,
    {
      resolve,
      postResolve,
    }: {
      resolve: (newVel: ex.Vector) => ex.Vector
      postResolve?: (newVel: ex.Vector) => void
    },
  ) {
    const newVel = this.owner.vel.clone()
    resolve(newVel)

    const contact = new RaycastCollisionContact(this.owner.collider.get(), hit)
    this.owner.onPreCollisionResolve(
      this.owner.collider.get(),
      hit.collider,
      contact.side,
      contact,
    )

    if (contact.isCanceled()) {
      return
    }

    this.owner.vel.setTo(newVel.x, newVel.y)

    if (postResolve) {
      postResolve(newVel)
    }

    this.owner.onPostCollisionResolve(
      this.owner.collider.get(),
      hit.collider,
      contact.side,
      contact,
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
  climbingSlope = false
  descendingSlope = false

  reset() {
    this.top = false
    this.bottom = false
    this.left = false
    this.right = false

    this.slopeAngleOld = this.slopeAngle
    this.slopeAngle = 0

    this.climbingSlope = false
    this.descendingSlope = false
  }
}

/**
 * Creates an ex.CollisionContact from an ex.RayCastHit. Not all data is
 * available from an ex.RayCastHit so some data is left blank or guessed.
 */
export class RaycastCollisionContact extends ex.CollisionContact {
  side: ex.Side

  constructor(self: ex.Collider, hit: ex.RayCastHit) {
    let side!: ex.Side

    const bounds = self.bounds
    const left = bounds.left
    const right = bounds.right
    const top = bounds.top
    const bottom = bounds.bottom

    if (hit.point.y <= top) {
      side = ex.Side.Top
    } else if (hit.point.y >= bottom) {
      side = ex.Side.Bottom
    } else if (hit.point.x <= left) {
      side = ex.Side.Left
    } else if (hit.point.x >= right) {
      side = ex.Side.Right
    }

    super(
      self,
      hit.collider,
      self.owner.get(ex.BodyComponent)!.vel,
      hit.normal,
      hit.point,
      [],
      [],
      {
        collider: hit.collider,
        point: hit.point,
        axis: ex.vec(
          side === ex.Side.Left || side === ex.Side.Right ? 1 : 0,
          side === ex.Side.Top || side === ex.Side.Bottom ? 1 : 0,
        ),
        separation: hit.distance,
      },
    )
    this.side = side
  }
}
