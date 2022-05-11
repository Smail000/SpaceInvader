// Including modules and libraries 
const ip = require('ip')
const path = require('path')
const express = require('express')
const app = express()
const http = require('http')
const server = http.createServer(app)
const { Server } = require("socket.io")
const io = new Server(server)

const { debug, online, hostname, speedLimit, speedLimitBorder } = require('./config.js')
const { createBullet, createSpeedBoost, createEnemy, createPlayer, States } = require('./objects.js')
const { randint, getDistance, getCoordsByStep } = require('./functions.js')
const { performance } = require('perf_hooks')

// Variables
var playersInGame = []
// player -> {name: string, socket: socket object, x: number, y: 
// number, state: string, stateTime: number, speedLimitReachedTimes: number,
// options: { airshipTexture: string, bulletTexture: string, bulletDamage: number, health: number }}

var GameObjects = [] // object -> 
// {id: number, textureName: string, scale: number, rotate: number, x: number, y: number, 
// lineMovement: {enable: boolean, speedX: number, speedY: number}, 
// roadMovement: {enable: boolean, points: [{x, y, step}...], correntPointId: number, destroyAfterGoal: bool}, 
// collision: {enable: bool, distance: number, damage: number}} 

var GameObjectCount = 0

// Static folder
app.use(express.static('static'))

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'index.html'))
})

io.on('connection', (socket) => {
    if (debug) console.log('a user connected')

    socket.on('register', (msg) => { // name, x, y
        if (debug) console.log('a user registered to the game')
        playersInGame.push(createPlayer(msg.name, socket, msg.x, msg.y))
    })

    // socket.on('createObject', (obj) => { // object example
    //     obj.id = GameObjectCount
    //     GameObjectCount++
    //     GameObjects.push(obj)
    // })

    socket.on('move', (msg) => { // x, y
        for (let player of playersInGame) {
            if (player['socket'] == socket) {

                if (getDistance(player.x, player.y, msg.x, msg.y) > speedLimit) { // fast move detecter
                    player.speedLimitReachedTimes++
                    if (player.speedLimitReachedTimes >= speedLimitBorder) {
                        player.speedLimitReachedTimes = 0
                        socket.emit('fastMove', {data: Math.round(getDistance(player.x, player.y, msg.x, msg.y))})
                    }
                }

                player.x = msg.x
                player.y = msg.y

                return
            }
        }
    })

    socket.on('disconnect', () => { // nothing
        for (let playerId in playersInGame) {
            if (playersInGame[playerId]['socket'] == socket) {
                io.emit('playerDisconnected', {data: playersInGame[playerId].name})
                if (debug) console.log(`Player with name ${playersInGame[playerId].name} has disconnected`)
                playersInGame.splice(playerId, 1)
                return
            }
        }
        if (debug) console.log(`Unkown user has disconnected`)
    })
})

// tick updater loop
var updaterLoop = setInterval(() => {
    for (var objId in GameObjects) {
        let obj = GameObjects[objId]

        if (obj.movement.enable) {
            if (obj.type == 'object') {
                obj.x += obj.movement.speedX
                obj.y += obj.movement.speedY
            } else if (obj.movement.points.length > obj.movement.correntPointId) {
                let point = obj.movement.points[obj.movement.correntPointId]
                let coords = getCoordsByStep(obj.x, obj.y, point.x, point.y, point.step)
                obj.x = coords[0]
                obj.y = coords[1]
                if (coords[2]) {
                    obj.movement.correntPointId++
                }
                if (obj.movement.loop && obj.movement.points.length <= obj.movement.correntPointId) {
                    obj.movement.correntPointId = 0
                }
            }
        }
        
        if (obj.type == 'object' && obj.collision.enable) {
            for (let player of playersInGame)  {
                if (getDistance(player.x, player.y, obj.x, obj.y) <= obj.collision.distance) {

                    if (obj.textureName == 'speedBoost') {
                        player.state = 'boost'
                        player.stateTime = performance.now()
                        States.boost.func(player)
    
                        GameObjects.splice(objId, 1)
                        continue
                    } else

                    if (obj.damage.canDamage) {
                        console.log(`Player ${player.name} got ${obj.damage.value} damage`)
                        GameObjects.splice(objId, 1)
                    }
                    
                }
            }
        }


        if (obj.type == 'entity' && obj.attack.damageable) {
            for (let anotherObjId in GameObjects)  {
                let anotherObj = GameObjects[anotherObjId]
                if (anotherObj.type != 'object') continue

                if (anotherObj.damage.canDamage && 
                    (getDistance(anotherObj.x, anotherObj.y, obj.x, obj.y) <= anotherObj.collision.distance) && 
                    anotherObj.side == 'player') {
                    GameObjects.splice(anotherObjId, 1)
                    obj.health -= anotherObj.damage.value
                    
                    if (obj.health <= 0) {
                        GameObjects.splice(objId, 1)
                        continue
                    }
                }
            }
        }
    }
    GameObjects = GameObjects.filter(n => n.y < 1.15 && n.y > -0.15 && n.x < 1.15 && n.x > -0.15 )
    io.emit('move', {players: playersInGame.map(n => ({
        name: n.name, x: n.x, y: n.y, texture: n.options.airshipTexture
    })), objects: GameObjects})
}, 10)

var bulletsShooterAndStateChecker = setInterval(() => {
    for (let player of playersInGame) {
        if (!isNaN(States[player.state].duration) && (performance.now()-player.stateTime)/1000 > States[player.state].duration) {
            States.base.func(player)
            player.state = 'base'
            player.stateTime = performance.now()
        }
        GameObjects.push(
            createBullet(
                x=player.x, 
                y=player.y, 
                id=GameObjectCount, 
                textureName=player.options.bulletTexture, 
                speed=player.options.bulletSpeed,
                damage=player.options.bulletDamage
            )
        )
        GameObjectCount++
        if (player.speedLimitReachedTimes > 0) player.speedLimitReachedTimes-- 
    }
}, 800)
    
var enemyBulletShooter = setInterval(() => {
    for (let enemy of GameObjects) {
        if (enemy.type != 'entity') continue
        if (enemy.attack.enable) {
            let bullet = createBullet(
                x=enemy.x, 
                y=enemy.y, 
                id=GameObjectCount, 
                textureName=enemy.attack.bulletTexture, 
                speed=enemy.attack.bulletSpeed,
                damage=enemy.attack.bulletDamage
            )
            bullet.rotate = Math.PI/2
            bullet.side = 'enemy'
            bullet.collision.enable = true
            GameObjects.push(bullet)
            GameObjectCount++
        }
    }
}, 2000)

var boostGenerator = setInterval(() => {
    GameObjects.push(createSpeedBoost(x=randint(3, 97)/100, y=-0.01, id=GameObjectCount))
    GameObjectCount++
}, 20000)

setInterval(() => {
    GameObjects.push(createEnemy(x=0.5, y=-0.1, id=GameObjectCount))
    GameObjectCount++
}, 5000)

// here we go
server.listen(3000, hostname, () => {
    console.log(`listening on http://${!online ? hostname : ip.address()}:3000`)
})