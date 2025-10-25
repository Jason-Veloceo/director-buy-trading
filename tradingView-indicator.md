//@version=5
indicator("Payzors Trade From Date – TP/SL (+optional trailing) [Indicator]", overlay=true, max_lines_count=500, max_labels_count=500)

// ── Inputs ────────────────────────────────────────────────────────────────────
grpDate   = "Entry Date (Exchange Time)"
iyear     = input.int(2025, "Year",  group=grpDate, minval=1970, maxval=2100)
imonth    = input.int(6,    "Month", group=grpDate, minval=1,    maxval=12)
iday      = input.int(11,   "Day",   group=grpDate, minval=1,    maxval=31)

grpRR     = "Risk / Reward"
tpPct     = input.float(20.0, "Take Profit %", group=grpRR, minval=0.1, step=0.1)
slPct     = input.float(10.0, "Stop Loss %",   group=grpRR, minval=0.1, step=0.1)

grpTrail   = "Trailing (starts ONLY after TP is first touched)"
useTrail   = input.bool(false, "Enable Trailing After TP?", group=grpTrail)
trailPct   = input.float(5.0,  "Trailing Stop %",           group=grpTrail, minval=0.1, step=0.1)

grpEdge    = "Edge Cases"
slPriority = input.bool(true, "If TP & SL touched same bar, give SL priority", group=grpEdge)

// ── Find the selected daily bar by Y/M/D (exchange session time) ─────────────
isEntryDayD  = request.security(syminfo.tickerid, "D", (year == iyear) and (month == imonth) and (dayofmonth == iday))
entryCloseD  = request.security(syminfo.tickerid, "D", close)
entryTCloseD = request.security(syminfo.tickerid, "D", time_close)

var bool  entryCaptured = false
var float entryPrice    = na
var int   entryTClose   = na

if barstate.isfirst
    entryCaptured := false
    entryPrice    := na
    entryTClose   := na

if isEntryDayD and not entryCaptured
    entryCaptured := true
    entryPrice    := entryCloseD
    entryTClose   := entryTCloseD

dateFound = entryCaptured

// First bar AFTER that daily close
enterNow = dateFound and (time[1] < entryTClose) and (time >= entryTClose)

// ── Targets ───────────────────────────────────────────────────────────────────
tpPrice = na(entryPrice) ? na : entryPrice * (1 + tpPct/100.0)
slPrice = na(entryPrice) ? na : entryPrice * (1 - slPct/100.0)

// ── State ─────────────────────────────────────────────────────────────────────
var bool  inTrade        = false
var bool  trailActive    = false
var float trailStop      = na
var float highestSinceTP = na
var bool  tradeCompleted = false  // NEW: Prevents multiple signals
var float exitPrice      = na

// Initialize trade on entry
if enterNow and not tradeCompleted
    inTrade        := true
    trailActive    := false
    highestSinceTP := na
    trailStop      := na
    exitPrice      := na

// Exit conditions - only check if we're in a trade and haven't completed it yet
var bool exitTriggered = false
exitTriggered := false  // Reset each bar

if inTrade and not tradeCompleted
    tpHitThisBar = not na(tpPrice) and (high >= tpPrice)
    slHitThisBar = not na(slPrice) and (low <= slPrice)
    
    // Handle non-trailing scenario
    if not useTrail
        if slPriority
            if slHitThisBar
                exitTriggered := true
                exitPrice := slPrice
                inTrade := false
                tradeCompleted := true
            else if tpHitThisBar
                exitTriggered := true
                exitPrice := tpPrice
                inTrade := false
                tradeCompleted := true
        else
            if tpHitThisBar
                exitTriggered := true
                exitPrice := tpPrice
                inTrade := false
                tradeCompleted := true
            else if slHitThisBar
                exitTriggered := true
                exitPrice := slPrice
                inTrade := false
                tradeCompleted := true
    
    // Handle trailing scenario
    else
        // Check stop loss first (always active)
        if slHitThisBar
            exitTriggered := true
            exitPrice := slPrice
            inTrade := false
            tradeCompleted := true
        // Activate trailing after TP hit
        else if tpHitThisBar and not trailActive
            trailActive := true
            highestSinceTP := high
            trailStop := highestSinceTP * (1 - trailPct/100.0)
        
        // Update trailing stop if active
        if trailActive and not exitTriggered
            highestSinceTP := math.max(highestSinceTP, high)
            trailStop := highestSinceTP * (1 - trailPct/100.0)
            
            // Check trailing stop
            if low <= trailStop
                exitTriggered := true
                exitPrice := trailStop
                inTrade := false
                tradeCompleted := true

// ── Visuals ───────────────────────────────────────────────────────────────────
plot(entryPrice, "Entry Close (Selected Date)", color=color.new(color.aqua, 0), style=plot.style_linebr, linewidth=2)
plot(tpPrice, "Take Profit", color=color.new(color.green, 0), style=plot.style_linebr)
plot(slPrice, "Stop Loss", color=color.new(color.red, 0), style=plot.style_linebr)
plot(useTrail and trailActive ? trailStop : na, "Trailing Stop (active after TP)", color=color.new(color.orange, 0), style=plot.style_linebr, linewidth=2)

// Labels - only show once per trade
if enterNow and not tradeCompleted
    label.new(bar_index, close, "BUY\n" + str.tostring(entryPrice, format.mintick), style=label.style_label_up, textcolor=color.white, color=color.new(color.green, 0))

if exitTriggered
    label.new(bar_index, close, "SELL\n" + str.tostring(exitPrice, format.mintick), style=label.style_label_down, textcolor=color.white, color=color.new(color.red, 0))

// Plot markers - only show once per trade
plotshape(enterNow and not tradeCompleted, title="BUY Marker", style=shape.triangleup, location=location.belowbar, color=color.new(color.green, 0), size=size.tiny, text="BUY")
plotshape(exitTriggered, title="SELL Marker", style=shape.triangledown, location=location.abovebar, color=color.new(color.red, 0), size=size.tiny, text="SELL")

// Alerts
alertcondition(enterNow and not tradeCompleted, "Trade Entered", "Entered trade at selected date close on {{ticker}}")
alertcondition(exitTriggered, "Trade Exited", "Exited trade on {{ticker}} at {{close}}")

// Status table
var table t = table.new(position.top_left, 1, 8, border_width=1)
if barstate.islast
    table.cell(t, 0, 0, "Date Found", text_color=color.white, bgcolor=color.new(color.silver, 30))
    table.cell(t, 0, 1, dateFound ? "Yes" : "No")
    table.cell(t, 0, 2, "Entry Close", text_color=color.white, bgcolor=color.new(color.silver, 30))
    table.cell(t, 0, 3, na(entryPrice) ? "N/A" : str.tostring(entryPrice, format.mintick))
    table.cell(t, 0, 4, "TP/SL %", text_color=color.white, bgcolor=color.new(color.silver, 30))
    table.cell(t, 0, 5, str.format("{0}% / {1}%", tpPct, slPct))
    table.cell(t, 0, 6, "Trade Status", text_color=color.white, bgcolor=color.new(color.silver, 30))
    table.cell(t, 0, 7, tradeCompleted ? "Completed" : (inTrade ? "Active" : "Waiting"))