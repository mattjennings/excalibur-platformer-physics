import { Actor } from '@/classes/actor'
import { Engine } from 'excalibur'

export default class Player extends Actor {
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

  onInitialize() {}

  onPreUpdate(engine: Engine, delta: number): void {
    if (engine.input.keyboard.isHeld(ex.Keys.Left)) {
      this.vel.x = -0.2 * delta
    } else if (engine.input.keyboard.isHeld(ex.Keys.Right)) {
      this.vel.x = 0.2 * delta
    } else {
      this.vel.x = 0
    }
  }
}
