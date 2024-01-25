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

  horizontalRaySpacing = 0
  verticalRaySpacing = 0

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

    for (const collider of this.collisions.inContactWithOld) {
      if (!this.collisions.inContactWith.has(collider)) {
        this.owner.emit(
          'collisionend',
          new ex.CollisionEndEvent(this.owner, collider.owner),
        )
        this.owner.onCollisionEnd(this.owner.collider.get(), collider)
      }
    }
  }

  checkCollision(
    side: ex.Side,
    distance: number,
  ):
    | (ex.RayCastHit & {
        contact: RaycastCollisionContact
        rayIndex: number
      })
    | false {
    this.updateRaycastOrigins()

    if (side === ex.Side.Left || side === ex.Side.Right) {
      const dirX = side === ex.Side.Left ? -1 : 1
      let rayLength = distance + this.skinWidth

      let shortest:
        | {
            contact: RaycastCollisionContact
            index: number
          }
        | undefined

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

        if (hit) {
          const contact = new RaycastCollisionContact(
            this.owner.collider.get(),
            hit,
          )

          if (!shortest || shortest.contact.hit.distance > hit.distance) {
            rayLength = hit.distance
            shortest = {
              contact,
              index: i,
            }
          }
        }
      }

      if (shortest) {
        this.owner.onPreCollisionResolve(
          this.owner.collider.get(),
          shortest.contact.hit.collider,
          shortest.contact.side,
          shortest.contact,
        )

        if (!shortest.contact.isCanceled()) {
          return {
            ...shortest.contact.hit,
            contact: shortest.contact,
            rayIndex: shortest.index,
          }
        }
      }
    } else if (side === ex.Side.Top || side === ex.Side.Bottom) {
      const dirY = side === ex.Side.Top ? -1 : 1
      let rayLength = distance + this.skinWidth

      let shortest:
        | {
            contact: RaycastCollisionContact
            index: number
          }
        | undefined

      for (let i = 0; i < this.verticalRayCount; i++) {
        const rayOrigin =
          dirY === -1
            ? this.origins.topLeft.clone()
            : this.origins.bottomLeft.clone()

        rayOrigin.x += i * this.verticalRaySpacing

        const ray = new ex.Ray(rayOrigin, ex.vec(0, dirY))
        const [hit] = this.cast(ray, {
          maxDistance: rayLength,
        })

        if (this.debug) {
          Debug.drawRay(this.owner, ray, rayLength)
        }

        if (hit) {
          const contact = new RaycastCollisionContact(
            this.owner.collider.get(),
            hit,
          )

          if (!shortest || shortest.contact.hit.distance > hit.distance) {
            rayLength = hit.distance
            shortest = {
              contact,
              index: i,
            }
          }
        }
      }

      if (shortest) {
        this.owner.onPreCollisionResolve(
          this.owner.collider.get(),
          shortest.contact.hit.collider,
          shortest.contact.side,
          shortest.contact,
        )

        if (!shortest.contact.isCanceled()) {
          return {
            ...shortest.contact.hit,
            contact: shortest.contact,
            rayIndex: shortest.index,
          }
        }
      }
    }

    return false
  }

  /**
   * Handles vertical collisions given the velocity. It will
   * cast the necessary rays and adjust the velocity to account
   * for the collision.
   */
  verticalCollisions(vel: ex.Vector) {
    const hit =
      vel.y > 0
        ? this.checkCollision(ex.Side.Bottom, Math.abs(vel.y))
        : this.checkCollision(ex.Side.Top, Math.abs(vel.y))

    const dirY = Math.sign(vel.y)

    if (hit) {
      // move up to the point of collision
      vel.y = (hit.distance - this.skinWidth) * dirY

      // handle vertical collisions while climbing slopes
      if (this.collisions.climbingSlope) {
        vel.x =
          (-vel.y / Math.tan(this.collisions.slopeAngle)) * Math.sign(vel.x)
      }

      this.resolveCollision(vel, hit.contact)
    }

    // check if we've encountered a new slope horizontally while climbing a slope
    // this will handle a change in angle on an existing slope, and make sure we don't overshoot
    // the x vel adjustment based on the current slope angle
    if (this.collisions.climbingSlope) {
      const hit = this.checkCollision(
        Math.sign(vel.x) === -1 ? ex.Side.Left : ex.Side.Right,
        Math.abs(vel.x),
      )
      if (hit) {
        const slopeAngle = getVecAngle(hit.normal, ex.Vector.Up)
        if (slopeAngle !== this.collisions.slopeAngle) {
          vel.x = (hit.distance - this.skinWidth) * Math.sign(vel.x)
          this.collisions.slopeAngle = slopeAngle

          this.resolveCollision(vel, hit.contact)
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
    const hit =
      vel.x > 0
        ? this.checkCollision(ex.Side.Right, Math.abs(vel.x))
        : this.checkCollision(ex.Side.Left, Math.abs(vel.x))

    const dirX = Math.sign(vel.x)

    // resolve the collision
    if (hit) {
      const slopeAngle = getVecAngle(hit.normal, ex.Vector.Up)
      // if this is a climbable slope, climb it.
      // (only during the first ray since it is at the corner)
      if (hit.rayIndex === 0 && slopeAngle <= this.maxClimbAngle) {
        let distanceToSlopeStart = 0

        // we've hit a new slope - subtract from velocity.x the distance to the slope
        // so that we don't move into the slope before climbing
        if (slopeAngle !== this.collisions.slopeAngleOld) {
          distanceToSlopeStart = hit.distance - this.skinWidth
          vel.x -= distanceToSlopeStart * dirX
        }
        this.climbSlope(vel, slopeAngle)

        // we've finished climbing the slope for this frame, add back the distance we subtracted
        vel.x += distanceToSlopeStart * dirX

        this.resolveCollision(vel, hit.contact)
      }

      if (
        !this.collisions.climbingSlope ||
        (slopeAngle && slopeAngle > this.maxClimbAngle)
      ) {
        vel.x = (hit.distance - this.skinWidth) * dirX
        // handle horizontal collisions while climbing slopes
        if (this.collisions.climbingSlope) {
          vel.y = -Math.tan(this.collisions.slopeAngle) * Math.abs(vel.x)
        }

        this.resolveCollision(vel, hit.contact)
        // rayLength = hit.distance
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
  resolveCollision(vel: ex.Vector, contact: RaycastCollisionContact) {
    if (vel.y !== 0) {
      // debugger
    }
    if (
      !this.collisions.inContactWith.has(contact.hit.collider) &&
      !this.collisions.inContactWithOld.has(contact.hit.collider)
    ) {
      this.owner.emit(
        'collisionstart',
        new ex.CollisionStartEvent(
          this.owner,
          contact.hit.collider.owner,
          contact.side,
          contact,
        ),
      )
      this.owner.onCollisionStart(
        this.owner.collider.get(),
        contact.hit.collider,
        contact.side,
        contact,
      )
    }

    this.collisions.addContact(contact.hit.collider)
    this.owner.vel.setTo(vel.x, vel.y)

    switch (contact.side) {
      case ex.Side.Top:
        this.collisions.top = true
        break
      case ex.Side.Bottom:
        this.collisions.bottom = true
        break
      case ex.Side.Left:
        this.collisions.left = true
        break
      case ex.Side.Right:
        this.collisions.right = true
        break
    }

    this.owner.onPostCollisionResolve(
      this.owner.collider.get(),
      contact.hit.collider,
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

  // track which colliders we are in contact with to emit collision start/end events
  inContactWith = new Set<ex.Collider>()
  inContactWithOld = new Set<ex.Collider>()

  reset() {
    this.top = false
    this.bottom = false
    this.left = false
    this.right = false

    this.slopeAngleOld = this.slopeAngle
    this.slopeAngle = 0
    this.climbingSlope = false
    this.descendingSlope = false

    this.inContactWithOld = this.inContactWith
    this.inContactWith = new Set()
  }

  addContact(collider: ex.Collider) {
    this.inContactWith.add(collider)
  }
}

/**
 * Creates an ex.CollisionContact from an ex.RayCastHit. Not all data is
 * available from an ex.RayCastHit so some data is left blank or guessed.
 */
export class RaycastCollisionContact extends ex.CollisionContact {
  side: ex.Side
  hit: ex.RayCastHit

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
    this.hit = hit
    this.side = side
  }
}
