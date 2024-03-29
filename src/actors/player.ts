import { Actor } from '@/classes/actor'
import { Collider, CollisionContact, Engine, Side } from 'excalibur'

export default class Player extends Actor {
  jumpHeight = 100 / 60 // 100px at 60fps
  timeToJumpApex = 0.4

  jumpVelocity!: number

  constructor(x: number, y: number) {
    super({
      name: 'player',
      width: 32,
      height: 32,
      color: ex.Color.Green,
      x,
      y,
      collisionType: ex.CollisionType.Active,
    })
  }

  onInitialize() {
    this.physics.gravity = ex.vec(
      0,
      (2 * this.jumpHeight) / Math.pow(this.timeToJumpApex, 2),
    )

    this.jumpVelocity = (2 * this.jumpHeight) / this.timeToJumpApex
  }

  onPreUpdate(engine: Engine, delta: number): void {
    if (engine.input.keyboard.isHeld(ex.Keys.Left)) {
      this.vel.x = -0.2 * delta
    } else if (engine.input.keyboard.isHeld(ex.Keys.Right)) {
      this.vel.x = 0.2 * delta
    } else {
      this.vel.x = 0
    }

    if (
      engine.input.keyboard.wasPressed(ex.Keys.Space) &&
      this.physics.collisions.bottom
    ) {
      this.vel.y = -this.jumpVelocity
    }
  }

  onPreCollisionResolve(
    self: Collider,
    other: Collider,
    side: Side,
    contact: CollisionContact,
  ): void {
    if (side === ex.Side.Left) {
      // contact.cancel()
    }
  }
}
