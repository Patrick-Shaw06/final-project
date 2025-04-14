# Set Group for Radio Communications
radio.set_group(8)
music.set_tempo(200)

# Basic Functions for Movement
# Check for wall
def isWall(distanceThreshold):
    # If too close to wall, back up slightly
    if CutebotPro.ultrasonic(SonarUnit.CENTIMETERS) < 5:
        CutebotPro.pwm_cruise_control(-10, -10)
        CutebotPro.distance_running(CutebotProOrientation.RETREAT, 3, CutebotProDistanceUnits.CM)
    return CutebotPro.ultrasonic(SonarUnit.CENTIMETERS) < distanceThreshold

# Turning left
def turnLeft():
    CutebotPro.color_light(CutebotProRGBLight.RGBL, 0xff0000)
    CutebotPro.trolley_steering(CutebotProTurn.LEFT_IN_PLACE, 95)
    CutebotPro.turn_off_all_headlights()

# Turning right
def turnRight():
    CutebotPro.color_light(CutebotProRGBLight.RGBR, 0xff0000)
    CutebotPro.trolley_steering(CutebotProTurn.RIGHT_IN_PLACE, 95)
    CutebotPro.turn_off_all_headlights()

# Moving forwards
def moveForward():
    CutebotPro.color_light(CutebotProRGBLight.RGBA, 0x00ff00)
    # Move forwards until gridline is reached
    while abs(CutebotPro.get_offset()) >= 2800:
        CutebotPro.pwm_cruise_control(10, 10)
    # Too far left; the bot needs to turn right
    if CutebotPro.get_offset() > 0:
        while CutebotPro.get_offset() > 0 and CutebotPro.get_offset() < 3000:
            CutebotPro.color_light(CutebotProRGBLight.RGBR, 0x0000ff)
            CutebotPro.pwm_cruise_control(10, 0)
            CutebotPro.turn_off_all_headlights()
        CutebotPro.pwm_cruise_control(10, 10)
        CutebotPro.distance_running(CutebotProOrientation.ADVANCE, 5, CutebotProDistanceUnits.CM)
    # Too far right; the bot needs to turn left
    else:
        while CutebotPro.get_offset() < 0 and CutebotPro.get_offset() > -3000:
            CutebotPro.color_light(CutebotProRGBLight.RGBL, 0x0000ff)
            CutebotPro.pwm_cruise_control(0, 10)
            CutebotPro.turn_off_all_headlights()
        CutebotPro.pwm_cruise_control(10, 10)
        CutebotPro.distance_running(CutebotProOrientation.ADVANCE, 5, CutebotProDistanceUnits.CM)
    # Move forwards halfway into next grid square
    CutebotPro.distance_running(CutebotProOrientation.ADVANCE, 30.7 / 2, CutebotProDistanceUnits.CM)
    CutebotPro.turn_off_all_headlights()

# Function to Navigate Maze
def navigateMaze(distanceThreshold, magnetThreshold):
    '''
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
    '''
    moves = [] # List to store past moves
    # Navigate maze until magnet is found
    while (abs(input.magnetic_force(Dimension.Z)) < magnetThreshold):
        # Check left direction first
        turnLeft()
        move = 1
        # Turn right until open move found
        while isWall(distanceThreshold):
            turnRight()
            move += 1 # Increment to track which direction is moved
        moveForward() # Move forward to next square
        moves.append(move) # Save direction moved to list
    basic.show_leds("""
    . # # . .
    . # # # .
    . # # # #
    . # . . .
    # # # # #
    """) # To show that the bomb has been found

    # Play tones representing path taken
    for i in range(len(moves)):
        if moves[i] == 1:
            music.play(music.tone_playable(Note.C, music.beat(BeatFraction.WHOLE)), music.PlaybackMode.UNTIL_DONE)
        elif moves[i] == 2:
            music.play(music.tone_playable(Note.E, music.beat(BeatFraction.WHOLE)), music.PlaybackMode.UNTIL_DONE)
        elif moves[i] == 3:
            music.play(music.tone_playable(Note.G, music.beat(BeatFraction.WHOLE)), music.PlaybackMode.UNTIL_DONE)
        elif moves[i] == 4:
            music.play(music.tone_playable(Note.C5, music.beat(BeatFraction.WHOLE)), music.PlaybackMode.UNTIL_DONE)
        music.rest(music.beat(BeatFraction.HALF))

    music.rest(music.beat(BeatFraction.BREVE))

    '''
    Step 2 - Calculating Optimized Path:
    The move list is optimized by removing moves that lead towards dead ends.
    Dead ends require the bot to turn around, represented by a 4 in the move list.
    Duplicated moves leading up to these dead ends will add up to 4 as well.
    The resultant move instead of turning towards the last end will be the sum
        of the moves entering and exiting the dead end section.
    '''
    i = 0 # Loop through the list of moves
    while i < len(moves):
        if moves[i] == 4: # If the bot turned around on a certain move (reached a dead end)
            j = 1 # Use a second loop to find extent of dead end path
            while (i - j) >= 0 and (i + j) < len(moves) and (moves[i - j] + moves[i + j]) == 4:
                j += 1 # Increment j to move on to next pair of values
            # Build new list of moves with dead ends filtered out
            newMoves = moves[:i - j] # Moves before dead end
            newMoves.append(moves[i - j] + moves[i + j]) # Move made of combined moves entering and leaving dead end
            for k in range(i + j + 1, len(moves)): # Moves after dead end
                newMoves.append(moves[k])
            moves = newMoves
            i = 0 # Length and index of list changes. I could calculate the new list but its easier to just start at the beginning again.
        i += 1 # Increment i to move on to next index

    '''
    Step 3 - Transmitting Optimized Path
    Transmitting the optimized path simply requires iterating through moves
        and transmitting each value.
    To confirm transmission and reception, each bot will play a tone corresponding
        to the move transmitted.
    '''
    for i in range(len(moves)):
        # Transmit move
        radio.send_number(moves[i])

        # Play tone corresponding to move
        if moves[i] == 1:
            CutebotPro.color_light(CutebotProRGBLight.RGBL, 0xff0000)
            music.play(music.tone_playable(Note.C, music.beat(BeatFraction.WHOLE)), music.PlaybackMode.UNTIL_DONE)
        elif moves[i] == 2:
            CutebotPro.color_light(CutebotProRGBLight.RGBA, 0x00ff00)
            music.play(music.tone_playable(Note.E, music.beat(BeatFraction.WHOLE)), music.PlaybackMode.UNTIL_DONE)
        elif moves[i] == 3:
            CutebotPro.color_light(CutebotProRGBLight.RGBR, 0xff0000)
            music.play(music.tone_playable(Note.G, music.beat(BeatFraction.WHOLE)), music.PlaybackMode.UNTIL_DONE)
        music.rest(music.beat(BeatFraction.HALF))

        CutebotPro.turn_off_all_headlights()

    music.rest(music.beat(BeatFraction.BREVE))

    '''
    Step 4 - Reversing Optimized Path
    Reversing the optimized path can be done by first reversing the order of
        the optimized path from the previous step and then subtracting each
        element from 4 to find the opposite of each of the steps taken.
    '''
    exitMoves = []
    for i in range(len(moves)):
        # Take 4 minus the opposite element of moves
        exitMoves.append(4 - moves[len(moves) - i - 1])

    # Play tones representing path to exit
    for i in range(len(exitMoves)):
        if exitMoves[i] == 1:
            music.play(music.tone_playable(Note.C, music.beat(BeatFraction.WHOLE)), music.PlaybackMode.UNTIL_DONE)
        elif exitMoves[i] == 2:
            music.play(music.tone_playable(Note.E, music.beat(BeatFraction.WHOLE)), music.PlaybackMode.UNTIL_DONE)
        elif exitMoves[i] == 3:
            music.play(music.tone_playable(Note.G, music.beat(BeatFraction.WHOLE)), music.PlaybackMode.UNTIL_DONE)
        music.rest(music.beat(BeatFraction.HALF))

    '''
    Step 5 - Exiting the Maze
    The bot can exit the maze by turning around, moving forwards, then
        simply following the list of exit moves.
    '''
    # Turn around and move forwards to next square
    turnRight()
    turnRight()
    moveForward()
    # Follow list of moves to exit
    for i in range(len(exitMoves)):
        # Only options are 1 (left), 2 (forwards), or 3 (right)
        if exitMoves[i] == 1:
            turnLeft()
            moveForward()
        elif exitMoves[i] == 2:
            moveForward()
        elif exitMoves[i] == 3:
            turnRight()
            moveForward()

# Button A Pressed
def on_button_pressed_a():
    basic.show_leds("""
    . . # . .
    . # . # .
    # . . . #
    # # # # #
    # . . . #
    """)
    basic.pause(500)
    basic.clear_screen()

# Button B Pressed
def on_button_pressed_b():
    basic.show_leds("""
    # # # # .
    # . . . #
    # # # # .
    # . . . #
    # # # # .
    """)
    basic.pause(500)
    basic.clear_screen()
    linetracing()

# Radio Transmission
def on_received_number(move):
    if move == 1: # Turn left
        CutebotPro.color_light(CutebotProRGBLight.RGBL, 0xff0000)
        music.play(music.tone_playable(Note.C, music.beat(BeatFraction.WHOLE)), music.PlaybackMode.UNTIL_DONE)
    elif move == 2: # Go straight
        CutebotPro.color_light(CutebotProRGBLight.RGBA, 0x00ff00)
        music.play(music.tone_playable(Note.E, music.beat(BeatFraction.WHOLE)), music.PlaybackMode.UNTIL_DONE)
    elif move == 3: # Turn right
        CutebotPro.color_light(CutebotProRGBLight.RGBR, 0xff0000)
        music.play(music.tone_playable(Note.G, music.beat(BeatFraction.WHOLE)), music.PlaybackMode.UNTIL_DONE)
    music.rest(music.beat(BeatFraction.HALF))
    CutebotPro.turn_off_all_headlights()

# Interaction Handling
input.on_button_pressed(Button.A, on_button_pressed_a)
input.on_button_pressed(Button.B, on_button_pressed_b)
radio.on_received_number(on_received_number)


def linetracing():
    speed = 20
    min_range = 1500
    max_range = 2800
    magnet = 290
    while abs(input.magnetic_force(Dimension.Z)) <= magnet:
        # turn on headlights
        CutebotPro.get_offset()
        while CutebotPro.get_offset() in range(min_range,max_range) and abs(input.magnetic_force(Dimension.Z)) <= magnet:
            # while following offset using the right 2 sensors
            CutebotPro.turn_off_all_headlights()
            CutebotPro.color_light(CutebotProRGBLight.RGBA, 0x00ff00)
            CutebotPro.pwm_cruise_control(speed, speed)
            # go forward
        if CutebotPro.get_offset() >= max_range:
            # if it goes off the line (this only happens when only choice is to turn right)
            while CutebotPro.get_offset() >= max_range and abs(input.magnetic_force(Dimension.Z)) <= magnet:
                # turn right until find line
                CutebotPro.turn_off_all_headlights()
                CutebotPro.color_light(CutebotProRGBLight.RGBR, 0xff0000)
                CutebotPro.pwm_cruise_control(speed,-speed)
                CutebotPro.angle_running(CutebotProWheel.LEFT_WHEEL,40,CutebotProAngleUnits.ANGLE)
        else: # if it detects a line to the left
            while CutebotPro.get_offset() <= min_range and abs(input.magnetic_force(Dimension.Z)) <= magnet:
                # turn left until find line
                CutebotPro.turn_off_all_headlights()
                CutebotPro.color_light(CutebotProRGBLight.RGBL, 0xff0000)
                CutebotPro.pwm_cruise_control(-speed,speed)
                CutebotPro.angle_running(CutebotProWheel.RIGHT_WHEEL,40,CutebotProAngleUnits.ANGLE)
            CutebotPro.distance_running(CutebotProOrientation.ADVANCE,0.25, CutebotProDistanceUnits.CM)
    music.play(music.tone_playable(Note.C, music.beat(BeatFraction.WHOLE)), music.PlaybackMode.UNTIL_DONE)
    CutebotPro.turn_off_all_headlights()
    # Move into maze around magnet
    CutebotPro.pwm_cruise_control(-speed, -speed)
    CutebotPro.distance_running(CutebotProOrientation.RETREAT, 7, CutebotProDistanceUnits.CM)
    CutebotPro.pwm_cruise_control(speed, 0)
    CutebotPro.angle_running(CutebotProWheel.LEFT_WHEEL, 20,CutebotProAngleUnits.ANGLE)
    CutebotPro.pwm_cruise_control(speed, speed)
    CutebotPro.distance_running(CutebotProOrientation.ADVANCE, 25, CutebotProDistanceUnits.CM)
    # Navigate maze
    navigateMaze(20,300)
    # Celebrate!
    celebration()

def beautiful():
    music.set_volume(127)
    playLeadBridge()
    playLeadMelody()
    playLeadEnding()

i = 0
def playEighth(note: number):
    music.play(music.tone_playable(note, 161),
        music.PlaybackMode.UNTIL_DONE)
    music.rest(53)
def playDottedQuarter(note2: number):
    music.play(music.tone_playable(note2, 589),
        music.PlaybackMode.UNTIL_DONE)
    music.rest(53)
def playHalf(note3: number):
    music.play(music.tone_playable(note3, 804),
        music.PlaybackMode.UNTIL_DONE)
    music.rest(53)

def restHalf():
    music.rest(857)
def playLeadEnding():
    # Plays and queues on 1
    playDottedQuarter(330)
    playEighth(370)
    playQuarter(415)
    restQuarter()
    playEighth(415)
    playEighth(415)
    playEighth(415)
    playEighth(415)
    playTriplet(415, 370, 330)
def restQuarter():
    music.rest(428)
def playTriplet(note1: number, note22: number, note32: number):
    music.play(music.tone_playable(note1, 268),
        music.PlaybackMode.UNTIL_DONE)
    music.rest(53)
    music.play(music.tone_playable(note22, 268),
        music.PlaybackMode.UNTIL_DONE)
    music.rest(53)
    music.play(music.tone_playable(note32, 161),
        music.PlaybackMode.UNTIL_DONE)
    music.rest(53)
def playQuarter(note4: number):
    music.play(music.tone_playable(note4, 375),
        music.PlaybackMode.UNTIL_DONE)
    music.rest(53)
# restHalf()
def playLeadBridge():
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
def restWhole():
    music.rest(1714)
def restEighth():
    music.rest(214)
def playLeadMelody():
    # Begins on 3
    restEighth()
    playEighth(415)
    playEighth(370)
    playEighth(330)
    for index in range(2):
        j = 0
        while j < 2:
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
        while j < 4:
            playEighth(415)
            j += 1
        playTriplet(415, 370, 330)

def lightpause():
    basic.pause(100)

def celebration():
    control.in_background(beautiful)
    colors = [
            0xffff00, 0xb09eff, 0xff0000, 0xff00ff,
            0xffff00, 0x00ff00, 0xff0080, 0x00ffff,
            0x0000ff, 0xff0000, 0x7f00ff, 0xffa500,
            0x00ff00
            ]

    for loop in range(28):  # Repeat the pattern 28 times
        i = 0
        while i < len(colors):
            color = colors[i]
            if i % 2 == 0:
                CutebotPro.color_light(CutebotProRGBLight.RGBL, color)
            else:
                CutebotPro.color_light(CutebotProRGBLight.RGBR, color)
            lightpause()
            i += 1
    final_color = 0xffffff  # End on white
    CutebotPro.color_light(CutebotProRGBLight.RGBL, final_color)
    CutebotPro.color_light(CutebotProRGBLight.RGBR, final_color)