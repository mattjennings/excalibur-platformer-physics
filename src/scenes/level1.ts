import Player from '@/actors/player'
import { Actor } from '@/classes/actor'
import { Scene } from '@/classes/scene'

ex.Physics.acc = ex.vec(0, 800)
ex.Physics.useArcadePhysics()

export default class Level1 extends Scene {
  onInitialize() {
    const player = new Player(100, 100)
    this.add(player)

    const ground = new ex.Actor({
      name: 'ground',
      width: 300,
      height: 16,
      color: ex.Color.Green,
      x: 170,
      y: 250,
      collisionType: ex.CollisionType.Fixed,
    })

    this.add(ground)

    const wall1 = new ex.Actor({
      name: 'wall1',
      width: 16,
      height: 100,
      color: ex.Color.Green,
      x: 100,
      y: 200,
      collisionType: ex.CollisionType.Fixed,
    })
    this.add(wall1)

    const wall2 = new ex.Actor({
      name: 'wall2',
      width: 16,
      height: 100,
      color: ex.Color.Green,
      x: 240,
      y: 200,
      collisionType: ex.CollisionType.Fixed,
    })
    this.add(wall2)
  }
}
