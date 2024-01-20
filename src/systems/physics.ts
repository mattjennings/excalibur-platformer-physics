import { PhysicsComponent } from '@/components/physics/physics'
import { AddedEntity, RemovedEntity } from 'excalibur'

export class PhysicsSystem extends ex.System {
  readonly types = ['ex.transform', 'ex.motion', 'ex.collider'] as const
  systemType = ex.SystemType.Update
  priority = -1

  engine!: ex.Engine
  processor!: ex.DynamicTreeCollisionProcessor

  initialize(scene: ex.Scene) {
    this.engine = scene.engine
    this.processor = scene.physics.collisionProcessor
  }

  notify(message: AddedEntity | RemovedEntity) {
    if (ex.isAddedSystemEntity(message)) {
      const colliderComponent = message.data.get(ex.ColliderComponent)!
      colliderComponent.$colliderAdded.subscribe(this.processor.track)
      colliderComponent.$colliderRemoved.subscribe(this.processor.untrack)
      const collider = colliderComponent.get()
      if (collider) {
        this.processor.track(collider)
      }
    } else {
      const colliderComponent = message.data.get(ex.ColliderComponent)!
      const collider = colliderComponent.get()
      if (colliderComponent && collider) {
        this.processor.untrack(collider)
      }
    }
  }

  update(entities: ex.Entity[], elapsedMs: number): void {
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i]

      this.updateCollider(entity)
      this.applyMotion(entity, elapsedMs)
    }
  }

  updateCollider(entity: ex.Entity) {
    let colliders: ex.Collider[] = []

    // Collect up all the colliders and update them
    const colliderComp = entity.get(ex.ColliderComponent)
    const collider = colliderComp?.get()
    if (colliderComp && colliderComp.owner?.active && collider) {
      colliderComp.update()
      if (collider instanceof ex.CompositeCollider) {
        const compositeColliders = collider.getColliders()
        colliders = colliders.concat(compositeColliders)
      } else {
        colliders.push(collider)
      }
    }
  }

  applyMotion(entity: ex.Entity, elapsedMs: number) {
    const seconds = elapsedMs / 1000

    const transform = entity.get(ex.TransformComponent)!
    const motion = entity.get(ex.MotionComponent)!
    const body = entity.get(ex.BodyComponent)
    const physics = entity.get(PhysicsComponent)

    if (body?.sleeping) {
      return
    }

    const totalAcc = motion.acc.clone()
    if (body?.collisionType === ex.CollisionType.Active && physics?.gravity) {
      totalAcc.addEqual(physics.gravity)
    }

    motion.vel.addEqual(totalAcc.scale(seconds))

    if (physics) {
      physics.move(motion.vel)
    }

    body?.captureOldTransform()
    transform.pos.addEqual(motion.vel)
  }
}
