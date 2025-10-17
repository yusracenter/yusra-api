const errorHandler = (err, req, res, next) => {
	console.log(err);

	res.status(400).json(err.message || 'Internal Server Error');
};

export default errorHandler;
