//  Set Group for Radio Communications
radio.setGroup(8)
music.setTempo(200)
//  Basic Functions for Movement
//  Check for wall
function isWall(distanceThreshold: number) {
    //  If too close to wall, back up slightly
    if (CutebotPro.ultrasonic(SonarUnit.Centimeters) < 5) {
        CutebotPro.pwmCruiseControl(-10, -10)
        CutebotPro.distanceRunning(CutebotProOrientation.Retreat, 3, CutebotProDistanceUnits.Cm)
    }
    
    return CutebotPro.ultrasonic(SonarUnit.Centimeters) < distanceThreshold
}

//  Turning left
function turnLeft() {
    CutebotPro.colorLight(CutebotProRGBLight.RGBL, 0xff0000)
    CutebotPro.trolleySteering(CutebotProTurn.LeftInPlace, 95)
    CutebotPro.turnOffAllHeadlights()
}

//  Turning right
function turnRight() {
    CutebotPro.colorLight(CutebotProRGBLight.RGBR, 0xff0000)
    CutebotPro.trolleySteering(CutebotProTurn.RightInPlace, 95)
    CutebotPro.turnOffAllHeadlights()
}

//  Moving forwards
function moveForward() {
    CutebotPro.colorLight(CutebotProRGBLight.RGBA, 0x00ff00)
    //  Move forwards until gridline is reached
    while (Math.abs(CutebotPro.getOffset()) >= 2800) {
        CutebotPro.pwmCruiseControl(10, 10)
    }
    //  Too far left; the bot needs to turn right
    if (CutebotPro.getOffset() > 0) {
        while (CutebotPro.getOffset() > 0 && CutebotPro.getOffset() < 3000) {
            CutebotPro.colorLight(CutebotProRGBLight.RGBR, 0x0000ff)
            CutebotPro.pwmCruiseControl(10, 0)
            CutebotPro.turnOffAllHeadlights()
        }
        CutebotPro.pwmCruiseControl(10, 10)
        CutebotPro.distanceRunning(CutebotProOrientation.Advance, 5, CutebotProDistanceUnits.Cm)
    } else {
        //  Too far right; the bot needs to turn left
        while (CutebotPro.getOffset() < 0 && CutebotPro.getOffset() > -3000) {
            CutebotPro.colorLight(CutebotProRGBLight.RGBL, 0x0000ff)
            CutebotPro.pwmCruiseControl(0, 10)
            CutebotPro.turnOffAllHeadlights()
        }
        CutebotPro.pwmCruiseControl(10, 10)
        CutebotPro.distanceRunning(CutebotProOrientation.Advance, 5, CutebotProDistanceUnits.Cm)
    }
    
    //  Move forwards halfway into next grid square
    CutebotPro.distanceRunning(CutebotProOrientation.Advance, 30.7 / 2, CutebotProDistanceUnits.Cm)
    CutebotPro.turnOffAllHeadlights()
}

//  Function to Navigate Maze
function navigateMaze(distanceThreshold: number, magnetThreshold: number) {
    let move: number;
    let i: number;
    let j: number;
    let newMoves: number[];
    /** 
    Navigating the maze is broken into four steps as follows:
        1: Pathfinding through the maze until the bomb is found
        2: Calculating an optimized path to the bomb
        3: Transmitting this path to second robot
        4: Reversing this path to optimize exiting
        5: Exiting the maze
    
    Step 1 - Pathfinding Through the Maze:
    The maze is navigated by always followling the left wall.
    This works by prioritizing turning left, then going forward,
        then turning right, and lastly backtracking.
    The bot will turn left and then go through each direction until
        it finds a direction it can go in.
    Move is incremented with each turn to represent the direction the
        bot goes, with the directions as follows:
            1: Left turn
            2: Forwards
            3: Right turn
            4: Backwards
    These directions are stored to later be reported once the bomb is found.
    
 */
    let moves = []
    //  List to store past moves
    //  Navigate maze until magnet is found
    while (Math.abs(input.magneticForce(Dimension.Z)) < magnetThreshold) {
        //  Check left direction first
        turnLeft()
        move = 1
        //  Turn right until open move found
        while (isWall(distanceThreshold)) {
            turnRight()
            move += 1
        }
        //  Increment to track which direction is moved
        moveForward()
        //  Move forward to next square
        moves.push(move)
    }
    //  Save direction moved to list
    basic.showLeds(`
    . # # . .
    . # # # .
    . # # # #
    . # . . .
    # # # # #
    `)
    //  To show that the bomb has been found
    //  Play tones representing path taken
    for (i = 0; i < moves.length; i++) {
        if (moves[i] == 1) {
            music.play(music.tonePlayable(Note.C, music.beat(BeatFraction.Whole)), music.PlaybackMode.UntilDone)
        } else if (moves[i] == 2) {
            music.play(music.tonePlayable(Note.E, music.beat(BeatFraction.Whole)), music.PlaybackMode.UntilDone)
        } else if (moves[i] == 3) {
            music.play(music.tonePlayable(Note.G, music.beat(BeatFraction.Whole)), music.PlaybackMode.UntilDone)
        } else if (moves[i] == 4) {
            music.play(music.tonePlayable(Note.C5, music.beat(BeatFraction.Whole)), music.PlaybackMode.UntilDone)
        }
        
        music.rest(music.beat(BeatFraction.Half))
    }
    music.rest(music.beat(BeatFraction.Breve))
    /** 
    Step 2 - Calculating Optimized Path:
    The move list is optimized by removing moves that lead towards dead ends.
    Dead ends require the bot to turn around, represented by a 4 in the move list.
    Duplicated moves leading up to these dead ends will add up to 4 as well.
    The resultant move instead of turning towards the last end will be the sum
        of the moves entering and exiting the dead end section.
    
 */
    i = 0
    //  Loop through the list of moves
    while (i < moves.length) {
        if (moves[i] == 4) {
            //  If the bot turned around on a certain move (reached a dead end)
            j = 1
            //  Use a second loop to find extent of dead end path
            while (i - j >= 0 && i + j < moves.length && moves[i - j] + moves[i + j] == 4) {
                j += 1
            }
            //  Increment j to move on to next pair of values
            //  Build new list of moves with dead ends filtered out
            newMoves = moves.slice(0, i - j)
            //  Moves before dead end
            newMoves.push(moves[i - j] + moves[i + j])
            //  Move made of combined moves entering and leaving dead end
            for (let k = i + j + 1; k < moves.length; k++) {
                //  Moves after dead end
                newMoves.push(moves[k])
            }
            moves = newMoves
            i = 0
        }
        
        //  Length and index of list changes. I could calculate the new list but its easier to just start at the beginning again.
        i += 1
    }
    //  Increment i to move on to next index
    /** 
    Step 3 - Transmitting Optimized Path
    Transmitting the optimized path simply requires iterating through moves
        and transmitting each value.
    To confirm transmission and reception, each bot will play a tone corresponding
        to the move transmitted.
    
 */
    for (i = 0; i < moves.length; i++) {
        //  Transmit move
        radio.sendNumber(moves[i])
        //  Play tone corresponding to move
        if (moves[i] == 1) {
            CutebotPro.colorLight(CutebotProRGBLight.RGBL, 0xff0000)
            music.play(music.tonePlayable(Note.C, music.beat(BeatFraction.Whole)), music.PlaybackMode.UntilDone)
        } else if (moves[i] == 2) {
            CutebotPro.colorLight(CutebotProRGBLight.RGBA, 0x00ff00)
            music.play(music.tonePlayable(Note.E, music.beat(BeatFraction.Whole)), music.PlaybackMode.UntilDone)
        } else if (moves[i] == 3) {
            CutebotPro.colorLight(CutebotProRGBLight.RGBR, 0xff0000)
            music.play(music.tonePlayable(Note.G, music.beat(BeatFraction.Whole)), music.PlaybackMode.UntilDone)
        }
        
        music.rest(music.beat(BeatFraction.Half))
        CutebotPro.turnOffAllHeadlights()
    }
    music.rest(music.beat(BeatFraction.Breve))
    /** 
    Step 4 - Reversing Optimized Path
    Reversing the optimized path can be done by first reversing the order of
        the optimized path from the previous step and then subtracting each
        element from 4 to find the opposite of each of the steps taken.
    
 */
    let exitMoves = []
    for (i = 0; i < moves.length; i++) {
        //  Take 4 minus the opposite element of moves
        exitMoves.push(4 - moves[moves.length - i - 1])
    }
    //  Play tones representing path to exit
    for (i = 0; i < exitMoves.length; i++) {
        if (exitMoves[i] == 1) {
            music.play(music.tonePlayable(Note.C, music.beat(BeatFraction.Whole)), music.PlaybackMode.UntilDone)
        } else if (exitMoves[i] == 2) {
            music.play(music.tonePlayable(Note.E, music.beat(BeatFraction.Whole)), music.PlaybackMode.UntilDone)
        } else if (exitMoves[i] == 3) {
            music.play(music.tonePlayable(Note.G, music.beat(BeatFraction.Whole)), music.PlaybackMode.UntilDone)
        }
        
        music.rest(music.beat(BeatFraction.Half))
    }
    /** 
    Step 5 - Exiting the Maze
    The bot can exit the maze by turning around, moving forwards, then
        simply following the list of exit moves.
    
 */
    //  Turn around and move forwards to next square
    turnRight()
    turnRight()
    moveForward()
    //  Follow list of moves to exit
    for (i = 0; i < exitMoves.length; i++) {
        //  Only options are 1 (left), 2 (forwards), or 3 (right)
        if (exitMoves[i] == 1) {
            turnLeft()
            moveForward()
        } else if (exitMoves[i] == 2) {
            moveForward()
        } else if (exitMoves[i] == 3) {
            turnRight()
            moveForward()
        }
        
    }
}

//  Button A Pressed
//  Button B Pressed
//  Radio Transmission
//  Interaction Handling
input.onButtonPressed(Button.A, function on_button_pressed_a() {
    basic.showLeds(`
    . . # . .
    . # . # .
    # . . . #
    # # # # #
    # . . . #
    `)
    basic.pause(500)
    basic.clearScreen()
})
input.onButtonPressed(Button.B, function on_button_pressed_b() {
    basic.showLeds(`
    # # # # .
    # . . . #
    # # # # .
    # . . . #
    # # # # .
    `)
    basic.pause(500)
    basic.clearScreen()
    linetracing()
})
radio.onReceivedNumber(function on_received_number(move: number) {
    if (move == 1) {
        //  Turn left
        CutebotPro.colorLight(CutebotProRGBLight.RGBL, 0xff0000)
        music.play(music.tonePlayable(Note.C, music.beat(BeatFraction.Whole)), music.PlaybackMode.UntilDone)
    } else if (move == 2) {
        //  Go straight
        CutebotPro.colorLight(CutebotProRGBLight.RGBA, 0x00ff00)
        music.play(music.tonePlayable(Note.E, music.beat(BeatFraction.Whole)), music.PlaybackMode.UntilDone)
    } else if (move == 3) {
        //  Turn right
        CutebotPro.colorLight(CutebotProRGBLight.RGBR, 0xff0000)
        music.play(music.tonePlayable(Note.G, music.beat(BeatFraction.Whole)), music.PlaybackMode.UntilDone)
    }
    
    music.rest(music.beat(BeatFraction.Half))
    CutebotPro.turnOffAllHeadlights()
})
function linetracing() {
    let speed = 20
    let min_range = 1500
    let max_range = 2800
    let magnet = 290
    while (Math.abs(input.magneticForce(Dimension.Z)) <= magnet) {
        //  turn on headlights
        CutebotPro.getOffset()
        while (_py.range(min_range, max_range).indexOf(CutebotPro.getOffset()) >= 0 && Math.abs(input.magneticForce(Dimension.Z)) <= magnet) {
            //  while following offset using the right 2 sensors
            CutebotPro.turnOffAllHeadlights()
            CutebotPro.colorLight(CutebotProRGBLight.RGBA, 0x00ff00)
            CutebotPro.pwmCruiseControl(speed, speed)
        }
        //  go forward
        if (CutebotPro.getOffset() >= max_range) {
            //  if it goes off the line (this only happens when only choice is to turn right)
            while (CutebotPro.getOffset() >= max_range && Math.abs(input.magneticForce(Dimension.Z)) <= magnet) {
                //  turn right until find line
                CutebotPro.turnOffAllHeadlights()
                CutebotPro.colorLight(CutebotProRGBLight.RGBR, 0xff0000)
                CutebotPro.pwmCruiseControl(speed, -speed)
                CutebotPro.angleRunning(CutebotProWheel.LeftWheel, 40, CutebotProAngleUnits.Angle)
            }
        } else {
            //  if it detects a line to the left
            while (CutebotPro.getOffset() <= min_range && Math.abs(input.magneticForce(Dimension.Z)) <= magnet) {
                //  turn left until find line
                CutebotPro.turnOffAllHeadlights()
                CutebotPro.colorLight(CutebotProRGBLight.RGBL, 0xff0000)
                CutebotPro.pwmCruiseControl(-speed, speed)
                CutebotPro.angleRunning(CutebotProWheel.RightWheel, 40, CutebotProAngleUnits.Angle)
            }
            CutebotPro.distanceRunning(CutebotProOrientation.Advance, 0.25, CutebotProDistanceUnits.Cm)
        }
        
    }
    music.play(music.tonePlayable(Note.C, music.beat(BeatFraction.Whole)), music.PlaybackMode.UntilDone)
    CutebotPro.turnOffAllHeadlights()
    //  Move into maze around magnet
    CutebotPro.pwmCruiseControl(-speed, -speed)
    CutebotPro.distanceRunning(CutebotProOrientation.Retreat, 7, CutebotProDistanceUnits.Cm)
    CutebotPro.pwmCruiseControl(speed, 0)
    CutebotPro.angleRunning(CutebotProWheel.LeftWheel, 20, CutebotProAngleUnits.Angle)
    CutebotPro.pwmCruiseControl(speed, speed)
    CutebotPro.distanceRunning(CutebotProOrientation.Advance, 25, CutebotProDistanceUnits.Cm)
    //  Navigate maze
    navigateMaze(20, 300)
    //  Celebrate!
    celebration()
}

let i = 0
function playEighth(note: number) {
    music.play(music.tonePlayable(note, 161), music.PlaybackMode.UntilDone)
    music.rest(53)
}

function playDottedQuarter(note2: number) {
    music.play(music.tonePlayable(note2, 589), music.PlaybackMode.UntilDone)
    music.rest(53)
}

function playHalf(note3: number) {
    music.play(music.tonePlayable(note3, 804), music.PlaybackMode.UntilDone)
    music.rest(53)
}

function restHalf() {
    music.rest(857)
}

function playLeadEnding() {
    //  Plays and queues on 1
    playDottedQuarter(330)
    playEighth(370)
    playQuarter(415)
    restQuarter()
    playEighth(415)
    playEighth(415)
    playEighth(415)
    playEighth(415)
    playTriplet(415, 370, 330)
}

function restQuarter() {
    music.rest(428)
}

function playTriplet(note1: number, note22: number, note32: number) {
    music.play(music.tonePlayable(note1, 268), music.PlaybackMode.UntilDone)
    music.rest(53)
    music.play(music.tonePlayable(note22, 268), music.PlaybackMode.UntilDone)
    music.rest(53)
    music.play(music.tonePlayable(note32, 161), music.PlaybackMode.UntilDone)
    music.rest(53)
}

function playQuarter(note4: number) {
    music.play(music.tonePlayable(note4, 375), music.PlaybackMode.UntilDone)
    music.rest(53)
}

//  restHalf()
function playLeadBridge() {
    playQuarter(330)
    playEighth(415)
    playEighth(494)
    playQuarter(555)
    playEighth(555)
    playEighth(494)
    playQuarter(415)
    playEighth(415)
    playQuarter(415)
    playDottedQuarter(370)
    playQuarter(330)
    playEighth(415)
    playEighth(494)
    playQuarter(555)
    playEighth(555)
    playEighth(494)
    playDottedQuarter(415)
    playEighth(370)
}

function restWhole() {
    music.rest(1714)
}

function restEighth() {
    music.rest(214)
}

function playLeadMelody() {
    let j: number;
    //  Begins on 3
    restEighth()
    playEighth(415)
    playEighth(370)
    playEighth(330)
    for (let index = 0; index < 2; index++) {
        j = 0
        while (j < 2) {
            playTriplet(330, 330, 330)
            playTriplet(330, 330, 330)
            playQuarter(370)
            playEighth(415)
            playEighth(370)
            restEighth()
            playEighth(415)
            playEighth(370)
            playEighth(330)
            j += 1
        }
        playTriplet(330, 330, 330)
        playTriplet(330, 330, 330)
        playQuarter(415)
        playEighth(370)
        playEighth(370)
        restEighth()
        playEighth(415)
        playQuarter(370)
        playDottedQuarter(330)
        playEighth(370)
        playQuarter(415)
        restQuarter()
        j = 0
        while (j < 4) {
            playEighth(415)
            j += 1
        }
        playTriplet(415, 370, 330)
    }
}

function lightpause() {
    basic.pause(100)
}

function celebration() {
    let i: number;
    let color: number;
    control.inBackground(function beautiful() {
        music.setVolume(127)
        playLeadBridge()
        playLeadMelody()
        playLeadEnding()
    })
    let colors = [0xffff00, 0xb09eff, 0xff0000, 0xff00ff, 0xffff00, 0x00ff00, 0xff0080, 0x00ffff, 0x0000ff, 0xff0000, 0x7f00ff, 0xffa500, 0x00ff00]
    for (let loop = 0; loop < 28; loop++) {
        //  Repeat the pattern 28 times
        i = 0
        while (i < colors.length) {
            color = colors[i]
            if (i % 2 == 0) {
                CutebotPro.colorLight(CutebotProRGBLight.RGBL, color)
            } else {
                CutebotPro.colorLight(CutebotProRGBLight.RGBR, color)
            }
            
            lightpause()
            i += 1
        }
    }
    let final_color = 0xffffff
    //  End on white
    CutebotPro.colorLight(CutebotProRGBLight.RGBL, final_color)
    CutebotPro.colorLight(CutebotProRGBLight.RGBR, final_color)
}

