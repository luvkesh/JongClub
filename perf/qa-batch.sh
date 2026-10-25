#!/bin/bash
# usage: qa-batch.sh OUTDIR W H "var[:houseJSON] ..."
OUT=$1; W=$2; H=$3; shift 3
for spec in $@; do
  v=${spec%%:*}; hr='{}'; [[ $spec == *:* ]] && hr=${spec#*:}
  echo "=== $v $hr ${W}x${H}"
  timeout 1700 node perf/qa-play.cjs http://127.0.0.1:4173/ $OUT/${v}${hr//[^A-Za-z]/} $v $W $H 1 "$hr" 2>&1 | grep -v "^progress" | tail -15
done
