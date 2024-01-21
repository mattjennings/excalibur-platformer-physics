import Player from '@/actors/player'
import { Scene } from '@/classes/scene'

export default class Level1 extends Scene {
  onInitialize() {
    const player = new Player(150, 100)
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
      y: 212,
      collisionType: ex.CollisionType.Fixed,
      rotation: -Math.PI / 4,
    })
    this.add(wall1)

    const wall2 = new ex.Actor({
      name: 'wall2',
      width: 16,
      height: 100,
      color: ex.Color.Green,
      x: 240,
      y: 212,
      collisionType: ex.CollisionType.Fixed,
      rotation: Math.PI / 4,
    })
    this.add(wall2)

    const wall3 = new ex.Actor({
      name: 'wall3',
      width: 16,
      height: 100,
      color: ex.Color.Green,
      x: 250,
      y: 190,
      collisionType: ex.CollisionType.Fixed,
      rotation: Math.PI / 8,
    })
    this.add(wall3)
  }
}
