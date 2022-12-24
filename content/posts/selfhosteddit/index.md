---
title: Self Hosted Reddit
date: 2022-12-23
---

Every day the front page of reddit changes, but there's not an easy way to rewind time to see the front page (or some version of it) as it was some point in the past. Reddit database dumps exist but they can be difficult to wrangle due to their size and opacity. selfhosteddit lets you host the database dumps in a Postgres database and a familiar web frontend.

The code for this post can be found at [https://github.com/goatmobile/selfhosteddit](https://github.com/goatmobile/selfhosteddit).

The goals of this repo was to get the reddit database dumps into Postgres quickly and easily without requiring a ton of RAM or disk space. selfhosteddit does this by streaming records from the uncompressed dumps one by one, so the decompressed archive never needs to actually be stored on disk. These are then sent in a batch for the entire month's dump to [`pg_bulkload`](https://ossc-db.github.io/pg_bulkload/pg_bulkload.html), a tool for mass-loading data into Postgres. This is able to marshal all posts up to June 2022 (the extent of my testing) to Postgres in under a couple hours, with the final database and indices taking up XXXX GB on disk (run on a Ryzen 5900X + 64GB).

## Setup

To start you will need [docker and docker-compose installed](https://docs.docker.com/compose/install/), as well as a few packages to interact with Postgres. Grab the code repo from GitHub at https://github.com/goatmobile/selfhosteddit. All of this has only been tested on Ubuntu.

```bash
git clone https://github.com/goatmobile/selfhosteddit
cd selfhosteddit

# Install Python dependencies
python3 -m pip install requirements.txt

# Check that Docker Compose is installed
docker compose version
```

The various scripts below might need extra dependencies and will prompt you to automatically build them as necessary.

## Database

Running the database is straightforward Postgres in Docker. You'll need to pick a folder for Postgres to store its data in on a drive with enough space to hold the data you're trying to store.

```bash
# you can make this folder anywhere on your filesystem, but make sure to
# edit docker-compose.yml on the line '- <your folder>:/var/lib/postgresql/data'
mkdir -p pgdata

# set up a username and password for the database
export DB_USER=something
export DB_PASSWORD=changethis
sed "s/something/$DB_USER/g" -i docker-compose.yml
sed "s/changethis/$DB_PASSWORD/g" -i docker-compose.yml

# start the database
# 'r' is a command line tool: see https://goatmobile.github.io/blog/posts/rfile/
r up

# create the 'reddit' database inside Postgres (and check that it has correctly
# started)
psql -h localhost -U $POSTGRES_USER -c 'create database reddit;'
```

Once this is done the database is set up and ready to go. The "Data Loading" section below will go over adding database dumps to Postgres which will create the necessary tables and populate them.

## Data Loading

First you need to get the [reddit database dumps for posts](https://files.pushshift.io/reddit/submissions/) over the time period you are interested in. These are stored in [zstd](http://facebook.github.io/zstd/) compressed archives, sharded by month for all submissions. While there is a C library to interact with zstd archives, the out of the box [`zstd` command line tool](https://manpages.ubuntu.com/manpages/xenial/man1/unzstd.1.html) can already handle partially decompressing an archive and streaming the records to standard out, which can be piped through a couple more tools and finally into Postgres. Postgres has tools for this kind of mass-data-dumping, namely [`COPY`](https://www.postgresql.org/docs/current/sql-copy.html), which takes care of a lot of things that would make this prohibitively slow if each line was being mapped to an `INSERT INTO` statement and commit. In my testing I found that `pg_bulkload` was a touch faster and has nice support for handling duplicates which sometimes occurs (e.g. bad data in the dump or a retry of a previous insertion). Both `zstd` and `pg_bulkload` work pretty much by default, but there is some data munging in the middle required to take the JSON output of the database dump and get it into a delimiter-separated values file that `pg_bulkload` can consume. A short C++ program in [`parser/`]() using simdjson handles this.

`insert.py` and `upload.sh` wrap up all of this, so you just need to specify what dumps to upload.

```bash
# set number of parallel processes
export NPROC=$(expr $(nproc) / 3)

# upload one archive
python insert.py -j$NPROC --one /data/reddit/RS_2010-01.zst | ./upload.sh

# upload a range of archives (lexically sorted)
python insert.py -j$NPROC --end /data/reddit/RS_2022-06.zst | ./upload.sh
```

These scripts take care of everything so you just need to sit back and wait a while for it to complete. The data stored in the archives is exponential with time, so the first several years load in minutes while closer to 2022 it can take dozens of minutes.

### Indices

There are a lot of reddit posts through the years. Keeping these all in one database is easy to reason about but is very slow to search. Especially for this case where it's pretty much read-only, [database indices](https://en.wikipedia.org/wiki/Database_index) are essential to get decent query performance. Imagine search for all posts for a particular subreddit. By default this will require Postgres to check every row in the database to see if it matches the requested subreddit, hence the slowness. A probably wrong way but simple way to think about indices is as a hash map of the values in the index to the rows they come from. In this way indices trade disk space for performance (and make insertions slower since the indices must be updated, but that's not much of an issue here). With an index, the subreddit search becomes a map lookup which is much faster, then Postgres only needs to gather all of those rows.

Postgres' `EXPLAIN` shows at a high level the impact of indices without having to actually run anything. For the example above the query might look like:

```sql
SELECT * FROM post WHERE lower(subreddit)=lower('something') ORDER BY score desc, created_utc LIMIT 100
```

This would be easy for Postgres, just scan the table until it finds 100 matches, but the order makes it tricky since now Postgres needs to pick the top 100 scored posts, not just any random 100 posts that match the particular subreddit `something`. `EXPLAIN` shows this:

```sql
EXPLAIN SELECT * FROM post WHERE lower(subreddit)=lower('something') ORDER BY score desc, created_utc LIMIT 100
+---------------------------------------------------------------------------------------------+
| QUERY PLAN                                                                                  |
|---------------------------------------------------------------------------------------------|
| Limit  (cost=33070603.84..33070616.20 rows=100 width=711)                                   |
|   ->  Gather Merge  (cost=33070603.84..33290846.95 rows=1781007 width=711)                  |
|         Workers Planned: 8                                                                  |
|         ->  Sort  (cost=33069603.69..33070160.26 rows=2167642 width=711)                    |
|               Sort Key: score DESC, created_utc                                             |
|               ->  Parallel Seq Scan on post  (cost=0.00..33049829.76 rows=222626 width=711) |
|                     Filter: (lower((subreddit)::text) = 'something'::text)                  |
| JIT:                                                                                        |
|   Functions: 3                                                                              |
|   Options: Inlining true, Optimization true, Expressions true, Deforming true               |
+---------------------------------------------------------------------------------------------+
```

Adding indices is easy enough but they can take a while to build, almost as much as inserting the data itself.

```bash
r mkindex
```

After the indices are built `EXPLAIN` looks a bit different.

```sql
EXPLAIN SELECT * FROM post WHERE lower(subreddit)=lower('something') ORDER BY score desc, created_utc LIMIT 100
+----------------------------------------------------------------------------------------------------------+
| QUERY PLAN                                                                                               |
|----------------------------------------------------------------------------------------------------------|
| Limit  (cost=43293.39..43692.22 rows=100 width=711)                                                      |
|   ->  Incremental Sort  (cost=43293.39..8688447.59 rows=2167642 width=711)                               |
|         Sort Key: score DESC, created_utc                                                                |
|         Presorted Key: score                                                                             |
|         ->  Index Scan using sr_score_desc_index on post  (cost=0.20..8534369.93 rows=2167642 width=711) |
|               Index Cond: (lower((subreddit)::text) = 'something'::text)                                 |
+----------------------------------------------------------------------------------------------------------+
```

Note the change from `Seq Scan` to `Index Scan`! The cost estimate upper bound is lower by a few orders of magnitude as well.

## Web App

The rest of selfhosteddit is a client-server web app to read from the database and serve up results in a familiar format.

```bash
cd app

# start in debug mode
export DB_USER=...
export DB_PASSWORD=...
r

# start in production mode
echo "Not implemented"
```

Once that's up and running visit [http://localhost:5000](http://localhost:5000) in your browser.