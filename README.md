# publish.teach.org
The teach.org publishing service for X-Ray Goggles and Thimble

## Installation and Use

1) Clone the [publish.webmaker.org](https://github.com/mozilla/publish.webmaker.org) repository

```
$ git clone https://github.com/mozilla/publish.webmaker.org.git
```

2) Install the dependencies

```
$ npm install
```

If you also want to run the tests, install the **lab** testing utility globally

```
$ npm install -g lab
```

3) Copy the distributed environment file via command line, or manually using a code editor:

```
$ cp env.dist .env
```

4) Run the server at the default log level (`'info'`):

```
$ node app
```

The server's log level can be set in the environment or the .env file using `LOG_LEVEL=*` with one of `fatal`, `error`, `warn`, `info`, `debug`, `trace`.
If none is given `info` is used.
