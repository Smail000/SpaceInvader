const { performance } = require('perf_hooks')

module.exports.States = { // seconds
    base: {
        duration: NaN,
        func: (obj) => {
            obj.options.bulletTexture = 'bullet01'
            obj.options.bulletDamage = 1
            obj.options.bulletSpeed = -0.5
        }
    },

    boost: {
        duration: 5,
        func: (obj) => {
            obj.options.bulletTexture = 'bullet21'
            obj.options.bulletDamage = 5
            obj.options.bulletSpeed = -1
        }
    },
}

module.exports.createPlayer = (name, socket, x, y) => ({
    name: name,
    socket: socket,
    x: x,
    y: y,
    state: 'base',
    stateTime: performance.now(),
    speedLimitReachedTimes: 0,
    options: {
        airshipTexture: 'airshipTexture',
        bulletTexture: 'bullet01',
        bulletDamage: 1,
        bulletSpeed: -0.5,
        health: 100
    }
})

module.exports.createObject = () => ({
    id: 0,
    textureName: '',
    scale: 0.25, 
    rotate: 0, 
    x: 0, 
    y: 0,
    health: 1,
    lineMovement: {
        enable: false,
        speedX: 0,
        speedY: 0,
    },
    roadMovement: {
        enable: false,
        points: [
            {
                x: 0,
                y: 0,
                step: 0,
            },
        ],
        correntPointId: 0,
        destroyAfterGoal: false,
        loop: false,
    },
    collision: {
        enable: false,
        damageable: false,
        canDamage: false,
        distance: 0,
        damage: 0,
    },
})

module.exports.createBullet = (x=0, y=0, id=0, textureName='bullet01', speed=-0.5, damage=1) => {
    let object = module.exports.createObject()
    object.x = x
    object.y = y
    object.id = id
    object.rotate = 3*Math.PI/2
    object.textureName = textureName

    object.lineMovement.enable = true
    object.lineMovement.speedY = speed

    object.collision.canDamage = true
    object.collision.damage = damage
    object.collision.distance = 3
    return object
}

module.exports.createSpeedBoost = (x=0, y=0, id=0) => {
    let object = module.exports.createObject()
    object.x = x
    object.y = y
    object.id = id
    object.textureName = 'speedBoost'

    object.lineMovement.enable = true
    object.lineMovement.speedY = 0.1

    object.collision.enable = true
    object.collision.distance = 3
    return object
}


module.exports.createEnemy = (x=0, y=0, id=0) => {
    let object = module.exports.createObject()
    object.x = x
    object.y = y
    object.id = id
    object.rotate = Math.PI
    object.textureName = 'simpleEnemy'
    object.health = 5

    object.roadMovement.enable = true
    object.roadMovement.loop = true
    object.roadMovement.points = [
        {
            x: 50,
            y: 50,
        },
        {
            x: 10,
            y: 10,
        },
        {
            x: 90,
            y: 10,
        },
        {
            x: 50,
            y: 50,
        }
    ]
    for (let point of object.roadMovement.points) {point.step = 0.1}

    object.collision.damageable = true
    return object
}
