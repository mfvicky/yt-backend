const asyncHandler = (requestHandler) => {
    (res, req, next) => {
        Promise
            .resolve(requestHandler(res, req, next))
            .catch((error) => next(error))
    }
}

export { asyncHandler };

// const asyncHandler = () => { }
// const asyncHandler = (fn) => () => { }
// const asyncHandler = (fn) => aysnc() => { }
// const asyncHandler = (fn) => { () => { } }
// const asyncHandler = (fn) => async (req, res, next) => {
//     try {
//         await fn(req, res, next)
//     } catch (error) {
//         res.status(error.code || 500).json({
//             sucess: false,
//             message: error.message
//         })
//     }
// }