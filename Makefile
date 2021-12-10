dev: images notebooks_dev hugo_dev

dist: images notebooks
	rm -rf docs
	hugo -D
	# /snap/bin/hugo -D
	cp CNAME docs

notebooks_dev:
	find ./content -name "*.ipynb" | grep -v checkpoint | entr make notebooks

hugo_dev:
	hugo -F server -D
	# /snap/bin/hugo -F server -D
	

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
