import * as ex from 'excalibur'

export interface RaycastArgs {
  skinWidth?: number
  horizontalRaySpacing?: number
  verticalRaySpacing?: number
}

export class RaycastComponent extends ex.Component {
  declare owner: ex.Actor
  type = 'raycast'

  debug = true

  origins!: RaycastOrigins

  skinWidth = 1
  horizontalRayCount = 4
  verticalRayCount = 4

  private horizontalRaySpacing = 0
  private verticalRaySpacing = 0

  constructor(
    args: RaycastArgs = {
      skinWidth: 1,
      horizontalRaySpacing: 0,
      verticalRaySpacing: 0,
    },
  ) {
    super()

    if (typeof args.skinWidth !== 'undefined') {
      this.skinWidth = args.skinWidth
    }

    if (typeof args.horizontalRaySpacing !== 'undefined') {
      this.horizontalRaySpacing = args.horizontalRaySpacing
    }

    if (typeof args.verticalRaySpacing !== 'undefined') {
      this.verticalRaySpacing = args.verticalRaySpacing
    }
  }

  onAdd(owner: typeof this.owner): void {
    this.updateRaycastOrigins()
    this.calculateRaySpacing()
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

      const [hit] = this.cast(rayOrigin, ex.vec(0, dirY), {
        maxDistance: rayLength,
      })

      if (this.debug) {
        this.owner.scene.once('postdraw', ({ ctx }) => {
          const start = rayOrigin
          const end = rayOrigin.add(ex.vec(0, dirY * rayLength))

          const w = (v: ex.Vector) =>
            this.owner.scene.engine.screen.screenToWorldCoordinates(v)
          ctx.drawLine(w(start), w(end), ex.Color.Blue, 1)
        })
      }

      if (hit) {
        vel.y = (hit.distance - this.skinWidth) * dirY
        rayLength = hit.distance

        return true
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

      const [hit] = this.cast(rayOrigin, ex.vec(dirX, 0), {
        maxDistance: rayLength,
      })

      if (this.debug) {
        this.owner.scene.once('postdraw', ({ ctx }) => {
          const start = rayOrigin
          const end = rayOrigin.add(ex.vec(dirX * rayLength, 0))

          const w = (v: ex.Vector) =>
            this.owner.scene.engine.screen.screenToWorldCoordinates(v)
          ctx.drawLine(w(start), w(end), ex.Color.Blue, 1)
        })
      }

      if (hit) {
        vel.x = (hit.distance - this.skinWidth) * dirX
        rayLength = hit.distance

        return true
      }
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
    pos: ex.Vector,
    dir: ex.Vector,
    {
      exclude,
      ...opts
    }: ex.RayCastOptions & { exclude?: Array<{ body: ex.BodyComponent }> },
  ) => {
    const hits = this.owner.scene.physics.rayCast(new ex.Ray(pos, dir), {
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
