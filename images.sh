#!/bin/bash
find ./content -type f -name '*.jpg' | xargs -P8 exiftool -overwrite_original -all=
find ./content -type f -name '*.jpg' | xargs -P8 exiftool -overwrite_original -all=
find ./content -type f -name '*.jpg' | xargs -P8 exiftool -overwrite_original -all=

find ./content -type f -name '*.jpg' | xargs -P8 exiftool | grep GPS

# make all images a reasonable size (skip already resized ones since jpeg resizing is lossy)
FILES=$(find . -type f -name '*.jpg' -exec /bin/sh -c 'identify -format "%[fx:(h>700 || w>700)] " "$0"' {} \; -print | grep '^1' | awk '{print $2}')
echo "Resizing" $(echo $FILES | tr ' ' '\n' | xargs | wc -l) "files"
echo $FILES
echo $FILES | tr ' ' '\n' | xargs -P8 mogrify -resize 700x700\>

# helpful commands:
# rotate:
# mogrify -rotate 90 <image>

# convert heic:
# heif-convert input.heic output.jpg
# find . -type f - name "*.HEIC" | sed 's/.HEIC//g'
