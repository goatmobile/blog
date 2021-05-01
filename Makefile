dev: images notebooks
	hugo -F server -D

dist: images
	hugo -D

notebooks:
	python make_notebooks.py

wordcount:
	cd content
	find . -type f -name '*.md' -exec bash -c 'cat {} | wc -w'  \; | jq -s add

images:
	# bash ./images.sh
	echo "Skipping images"

setup:
	sudo apt install hugo imagemagick-6.q16 libimage-exiftool-perl
	# heic conversion:
	# sudo apt install libheif-examples

	# brew install hugo exiftool imagemagick
